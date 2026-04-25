import pytest
from django.core.management import call_command
from apps.workspaces.models import Workspace
from apps.clients.models import Client
from apps.deals.models import Deal
from apps.leads.models import Lead
from apps.custom_fields.models import CustomFieldDef


@pytest.mark.django_db
def test_seed_demo_populates_demo_workspace():
    call_command('seed_demo')
    ws = Workspace.objects.get(slug='demo')

    client_count = Client.objects.filter(workspace=ws).count()
    deal_count = Deal.objects.filter(workspace=ws).count()
    lead_count = Lead.objects.filter(workspace=ws).count()
    cf_count = CustomFieldDef.objects.filter(workspace=ws, entity='deal').count()

    assert client_count >= 10, f"Expected >= 10 clients, got {client_count}"
    assert deal_count >= 10, f"Expected >= 10 deals, got {deal_count}"
    assert lead_count >= 20, f"Expected >= 20 leads, got {lead_count}"
    assert cf_count == 3, f"Expected 3 custom field defs, got {cf_count}"


@pytest.mark.django_db
def test_seed_demo_idempotent():
    call_command('seed_demo')
    ws = Workspace.objects.get(slug='demo')
    count_before = Client.objects.filter(workspace=ws).count()

    call_command('seed_demo')  # second run — must skip
    count_after = Client.objects.filter(workspace=ws).count()

    assert count_before == count_after, (
        f"Second run changed client count: {count_before} → {count_after}"
    )


@pytest.mark.django_db
def test_seed_demo_reset_wipes_and_refills():
    call_command('seed_demo')
    ws = Workspace.objects.get(slug='demo')
    ws_id = ws.id

    client_count_1 = Client.objects.filter(workspace=ws).count()
    deal_count_1 = Deal.objects.filter(workspace=ws).count()
    lead_count_1 = Lead.objects.filter(workspace=ws).count()

    call_command('seed_demo', '--reset')

    # Workspace row preserved
    ws_after = Workspace.objects.get(slug='demo')
    assert ws_after.id == ws_id, "Workspace row should be preserved on --reset"

    client_count_2 = Client.objects.filter(workspace=ws_after).count()
    deal_count_2 = Deal.objects.filter(workspace=ws_after).count()
    lead_count_2 = Lead.objects.filter(workspace=ws_after).count()

    # Counts should be equal since data is deterministic (faker seed=42)
    assert client_count_1 == client_count_2, (
        f"Client counts differ after reset: {client_count_1} vs {client_count_2}"
    )
    assert deal_count_1 == deal_count_2, (
        f"Deal counts differ after reset: {deal_count_1} vs {deal_count_2}"
    )
    assert lead_count_1 == lead_count_2, (
        f"Lead counts differ after reset: {lead_count_1} vs {lead_count_2}"
    )
