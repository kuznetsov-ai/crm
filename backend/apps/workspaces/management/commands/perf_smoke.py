"""
Performance smoke command — exercises §11.3 targets:

  1. /api/deals/?pipeline_id=X  with 20k deals  → p95 < 400ms
  2. /api/activities/?entity=deal&entity_id=X  with 500 activities  → p95 < 200ms
  3. seed_bitrix_demo < 60s

Usage:
    python manage.py perf_smoke
    python manage.py perf_smoke --cleanup   # delete perf-smoke workspace afterwards
"""

import statistics
import time

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Performance smoke: seeds large dataset, times key endpoints, asserts p95 targets."

    def add_arguments(self, parser):
        parser.add_argument(
            "--cleanup",
            action="store_true",
            help="Delete the perf workspace after the run",
        )

    def handle(self, *args, **opts):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient

        from apps.activities.models import Activity
        from apps.clients.models import Client as CRMClient
        from apps.deals.models import Deal
        from apps.pipelines.models import Pipeline
        from apps.workspaces.models import Membership, Workspace

        User = get_user_model()

        # ------------------------------------------------------------------
        # 1. Seed perf-smoke workspace with 20k deals + 500 activities
        # ------------------------------------------------------------------
        self.stdout.write("Seeding perf-smoke workspace with 20k deals + 500 activities…")
        t0 = time.perf_counter()

        ws, _created = Workspace.objects.get_or_create(
            slug="perf-smoke", defaults={"name": "Perf smoke"}
        )

        # Use any existing user (or create a dedicated perf user).
        admin = User.objects.filter(email="demo@studio.crm").first()
        if admin is None:
            admin = User.objects.first()
        if admin is None:
            self.stderr.write("No users in the database — ABORT. Run migrations/seed first.")
            return

        Membership.objects.get_or_create(
            workspace=ws, user=admin, defaults={"role": "admin"}
        )

        pipeline = Pipeline.objects.filter(
            workspace=ws, kind="deal", is_default=True
        ).first()
        if not pipeline:
            from apps.pipelines.models import Stage

            self.stdout.write("  Creating default deal pipeline for perf-smoke workspace…")
            pipeline = Pipeline.objects.create(
                workspace=ws,
                kind="deal",
                name="Default sales",
                is_default=True,
            )
            Stage.objects.create(
                pipeline=pipeline,
                name="New",
                code="new",
                semantic="open",
                order=0,
            )

        first_stage = pipeline.stages.order_by("order").first()

        client_row = CRMClient.objects.filter(workspace=ws).first()
        if not client_row:
            client_row = CRMClient.objects.create(workspace=ws, name="Perf client")

        # Bulk-create deals (bypass signals via bulk_create)
        existing_deals = Deal.objects.filter(workspace=ws).count()
        if existing_deals < 20_000:
            BATCH = 1_000
            batch = []
            for i in range(20_000 - existing_deals):
                batch.append(
                    Deal(
                        workspace=ws,
                        client=client_row,
                        pipeline=pipeline,
                        stage=first_stage,
                        status="new_lead",
                        title=f"Perf deal {existing_deals + i}",
                        value_usd=i,
                    )
                )
                if len(batch) >= BATCH:
                    Deal.objects.bulk_create(batch, batch_size=BATCH)
                    batch.clear()
            if batch:
                Deal.objects.bulk_create(batch, batch_size=BATCH)

        # Pick a target deal for activity smoke
        target_deal = Deal.objects.filter(workspace=ws).first()

        existing_acts = Activity.objects.filter(
            workspace=ws, entity="deal", entity_id=target_deal.id
        ).count()
        if existing_acts < 500:
            activities = [
                Activity(
                    workspace=ws,
                    type=Activity.Type.NOTE,
                    entity=Activity.Entity.DEAL,
                    entity_id=target_deal.id,
                    body=f"Perf activity {existing_acts + i}",
                )
                for i in range(500 - existing_acts)
            ]
            Activity.objects.bulk_create(activities, batch_size=500)

        seed_elapsed = time.perf_counter() - t0
        self.stdout.write(f"Seeding took {seed_elapsed:.1f}s")

        # ------------------------------------------------------------------
        # 2. Measure key endpoints
        # ------------------------------------------------------------------
        # Use DRF APIClient + force_authenticate so the JWT auth layer is
        # bypassed cleanly (Django test Client + force_login only works with
        # SessionAuthentication which isn't configured in prod).
        c = APIClient()
        c.force_authenticate(user=admin)

        def time_request(path, iters=20):
            samples = []
            for _ in range(iters):
                t = time.perf_counter()
                resp = c.get(
                    path,
                    HTTP_X_WORKSPACE_SLUG="perf-smoke",
                    SERVER_NAME="localhost",
                )
                elapsed_ms = (time.perf_counter() - t) * 1000
                samples.append(elapsed_ms)
                if resp.status_code != 200:
                    self.stderr.write(
                        f"WARNING: {path} returned {resp.status_code}"
                    )
            return samples

        self.stdout.write("Measuring /api/deals/…")
        deals_samples = time_request(
            f"/api/deals/?pipeline_id={pipeline.id}&page_size=25"
        )
        p95_deals = statistics.quantiles(deals_samples, n=20)[18]
        self.stdout.write(
            f"  deals  p50={statistics.median(deals_samples):.0f}ms  "
            f"p95={p95_deals:.0f}ms"
        )

        self.stdout.write("Measuring /api/activities/…")
        activities_samples = time_request(
            f"/api/activities/?entity=deal&entity_id={target_deal.id}"
        )
        p95_activities = statistics.quantiles(activities_samples, n=20)[18]
        self.stdout.write(
            f"  activities  p50={statistics.median(activities_samples):.0f}ms  "
            f"p95={p95_activities:.0f}ms"
        )

        # ------------------------------------------------------------------
        # 3. Time seed_bitrix_demo
        # ------------------------------------------------------------------
        from django.core.management import call_command

        self.stdout.write("Timing seed_bitrix_demo…")
        # Use --reset so seed_bitrix_demo handles deletion of protected FKs.
        t = time.perf_counter()
        call_command("seed_bitrix_demo", reset=True, verbosity=0)
        seed_demo_elapsed = time.perf_counter() - t
        self.stdout.write(f"seed_bitrix_demo took {seed_demo_elapsed:.1f}s")

        # ------------------------------------------------------------------
        # 4. Assert targets
        # ------------------------------------------------------------------
        targets = [
            ("deals p95 < 400ms", p95_deals, 400),
            ("activities p95 < 200ms", p95_activities, 200),
            ("seed_bitrix_demo < 60s", seed_demo_elapsed * 1000, 60_000),
        ]
        self.stdout.write("")
        self.stdout.write("Targets:")
        all_ok = True
        for name, actual, budget in targets:
            ok = actual <= budget
            mark = self.style.SUCCESS("PASS") if ok else self.style.ERROR("FAIL")
            self.stdout.write(f"  {mark}  {name}: actual={actual:.0f} budget={budget}")
            all_ok = all_ok and ok

        if opts["cleanup"]:
            Workspace.objects.filter(slug="perf-smoke").delete()
            self.stdout.write("Cleaned up perf-smoke workspace.")

        if not all_ok:
            raise SystemExit(1)
