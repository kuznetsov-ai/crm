"""Import partners + bench people from the idev-hr Postgres database.

Reads HR_DB_URL (default host.docker.internal:5434) via psycopg2 and
upserts partners into `clients_client` and BENCH people into
`clients_benchperson`. Idempotent on re-run — uses INN / external_id.

Usage:
    python manage.py import_from_hr
    python manage.py import_from_hr --partners-only
    python manage.py import_from_hr --bench-only
    python manage.py import_from_hr --dry-run
"""
from __future__ import annotations

import os
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.clients.models import BenchPerson, Client
from apps.clients.risk import apply_risk


DEFAULT_HR_DB_URL = 'postgresql://postgres:idev2026@host.docker.internal:5434/idev'


class Command(BaseCommand):
    help = 'Import partners and bench people from idev-hr Postgres'

    def add_arguments(self, parser):
        parser.add_argument('--partners-only', action='store_true')
        parser.add_argument('--bench-only', action='store_true')
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--hr-db-url', default=os.environ.get('HR_DB_URL', DEFAULT_HR_DB_URL))

    def handle(self, *args, **opts):
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
        except ImportError:
            self.stderr.write('psycopg2 is not installed in the backend image')
            return

        conn = psycopg2.connect(opts['hr_db_url'])
        cur = conn.cursor(cursor_factory=RealDictCursor)

        if not opts['bench_only']:
            self._import_partners(cur, dry_run=opts['dry_run'])
        if not opts['partners_only']:
            self._import_bench(cur, dry_run=opts['dry_run'])

        cur.close()
        conn.close()

    # ── Partners → Client ────────────────────────────────────────────────
    def _import_partners(self, cur, dry_run: bool):
        cur.execute('''
            SELECT id, name, contact_name, contact_tg, email,
                   margin_terms, notes, inn, employees, revenue, risk_notes,
                   created_at
              FROM partners
          ORDER BY created_at ASC
        ''')
        rows = cur.fetchall()
        self.stdout.write(f'Partners in idev-hr: {len(rows)}')
        created, updated = 0, 0
        with transaction.atomic():
            for r in rows:
                # Normalize INN (take first digit group, digits only, cap at 12)
                raw_inn = (r['inn'] or '').strip()
                inn = ''
                if raw_inn:
                    digits = ''.join(ch for ch in raw_inn.split('/', 1)[0].split(',', 1)[0] if ch.isdigit())
                    if len(digits) in (10, 12):
                        inn = digits
                name = (r['name'] or '').strip()
                if not name:
                    continue
                existing = None
                if inn:
                    existing = Client.objects.filter(tax_id=inn, tax_id_country='RU').first()
                if not existing:
                    existing = Client.objects.filter(name__iexact=name).first()

                payload = {
                    'name': name,
                    'industry': (r.get('notes') or '').split('\n', 1)[0][:100] or 'Outstaff partner',
                    'tax_id': inn,
                    'tax_id_country': 'RU' if inn else '',
                    'status': 'active',
                    'description': (r.get('notes') or '')[:2000],
                    'risk_notes': (r.get('risk_notes') or '')[:500],
                }
                if existing:
                    for k, v in payload.items():
                        setattr(existing, k, v)
                    if not dry_run:
                        existing.save()
                        apply_risk(existing)
                    updated += 1
                else:
                    if not dry_run:
                        c = Client.objects.create(**payload)
                        apply_risk(c)
                    created += 1

                # Primary contact from contact_name + email + tg
                contact_name = (r.get('contact_name') or '').strip()
                contact_email = (r.get('email') or '').strip()
                contact_tg = (r.get('contact_tg') or '').strip()
                if existing and (contact_name or contact_email or contact_tg):
                    self._upsert_contact(existing, contact_name, contact_email, contact_tg, dry_run=dry_run)

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(
            f'Partners: created={created}, updated={updated} (dry_run={dry_run})'
        ))

    def _upsert_contact(self, client, name, email, tg, dry_run: bool):
        from apps.clients.models import Contact
        first, last = name.split(' ', 1) if ' ' in name else (name, '')
        existing = Contact.objects.filter(client=client, email=email).first() if email else None
        if not existing:
            existing = Contact.objects.filter(client=client, first_name=first, last_name=last).first()
        if existing:
            if email and not existing.email:
                existing.email = email
            if tg and not existing.telegram:
                existing.telegram = tg
            if not dry_run:
                existing.save()
        else:
            if not dry_run and (first or email or tg):
                Contact.objects.create(
                    client=client, first_name=first or 'Контакт', last_name=last,
                    email=email, telegram=tg,
                    role='decision_maker', is_primary=True,
                )

    # ── Persons(status=BENCH) → BenchPerson ──────────────────────────────
    def _import_bench(self, cur, dry_run: bool):
        cur.execute('''
            SELECT id, first_name, last_name, middle_name, email, phone, tg_handle,
                   stream, grade, rate, market_rate, skills, stack,
                   experience_years, location, source, notes, resume_url
              FROM persons
             WHERE status = 'BENCH'
          ORDER BY last_name, first_name
        ''')
        rows = cur.fetchall()
        self.stdout.write(f'Bench people in idev-hr: {len(rows)}')
        created, updated = 0, 0
        stream_map = {'ANALYST': 'ANALYST', 'JAVA': 'JAVA', 'ONE_C': 'ONE_C'}
        grade_map = {'JUNIOR': 'JUNIOR', 'MIDDLE': 'MIDDLE', 'MIDDLE_PLUS': 'MIDDLE_PLUS', 'SENIOR': 'SENIOR'}

        with transaction.atomic():
            for r in rows:
                ext_id = r['id']
                payload = {
                    'external_id': ext_id,
                    'first_name': r['first_name'] or '',
                    'last_name': r['last_name'] or '',
                    'middle_name': r.get('middle_name') or '',
                    'email': r.get('email') or '',
                    'phone': r.get('phone') or '',
                    'tg_handle': r.get('tg_handle') or '',
                    'stream': stream_map.get(r.get('stream') or '', 'OTHER'),
                    'grade': grade_map.get(r.get('grade') or '', ''),
                    'rate_usd': r.get('rate'),
                    'market_rate_usd': r.get('market_rate'),
                    'skills': list(r.get('skills') or []),
                    'stack': list(r.get('stack') or []),
                    'experience_years': r.get('experience_years'),
                    'location': r.get('location') or '',
                    'source': r.get('source') or '',
                    'notes': r.get('notes') or '',
                    'resume_url': r.get('resume_url') or '',
                    'is_available': True,
                }
                existing = BenchPerson.objects.filter(external_id=ext_id).first()
                if existing:
                    for k, v in payload.items():
                        setattr(existing, k, v)
                    if not dry_run:
                        existing.save()
                    updated += 1
                else:
                    if not dry_run:
                        BenchPerson.objects.create(**payload)
                    created += 1

            # Mark previously-bench people who are no longer on bench as unavailable
            current_ids = [r['id'] for r in rows]
            stale = BenchPerson.objects.filter(is_available=True).exclude(external_id__in=current_ids)
            stale_count = stale.count()
            if not dry_run:
                stale.update(is_available=False)

            if dry_run:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(
            f'Bench: created={created}, updated={updated}, marked_unavailable={stale_count} (dry_run={dry_run})'
        ))
