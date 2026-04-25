import pytest
from django.core.management import call_command
from apps.workspaces.models import Workspace
from apps.pipelines.models import Pipeline, Stage
from apps.clients.models import Client
from apps.deals.models import Deal
from apps.leads.models import Lead
from apps.custom_fields.models import CustomFieldDef
from apps.dictionaries.models import Source, LostReason


@pytest.mark.django_db
def test_seed_bitrix_demo_creates_workspace():
    call_command('seed_bitrix_demo')
    ws = Workspace.objects.get(slug='academy-tsg')
    assert ws.name == 'Академия ТСЖ (demo)'
    assert ws.settings.get('currency') == 'RUB'
    assert ws.settings.get('locale') == 'ru'
    assert ws.settings.get('brand_color') == '#0ea5e9'


@pytest.mark.django_db
def test_seed_bitrix_demo_pipelines():
    call_command('seed_bitrix_demo')
    ws = Workspace.objects.get(slug='academy-tsg')
    # 7 deal pipelines
    assert Pipeline.objects.filter(workspace=ws, kind='deal').count() == 7
    # 1 lead pipeline
    assert Pipeline.objects.filter(workspace=ws, kind='lead').count() == 1
    # Default deal pipeline exists
    assert Pipeline.objects.filter(workspace=ws, kind='deal', is_default=True).count() == 1
    default_pipeline = Pipeline.objects.get(workspace=ws, kind='deal', is_default=True)
    assert default_pipeline.name == 'Основная'
    # Each pipeline has at least one won and one lost stage
    for pipeline in Pipeline.objects.filter(workspace=ws, kind='deal'):
        assert Stage.objects.filter(pipeline=pipeline, semantic='won').exists(), \
            f"Pipeline '{pipeline.name}' missing won stage"
        assert Stage.objects.filter(pipeline=pipeline, semantic='lost').exists(), \
            f"Pipeline '{pipeline.name}' missing lost stage"


@pytest.mark.django_db
def test_seed_bitrix_demo_lead_pipeline():
    call_command('seed_bitrix_demo')
    ws = Workspace.objects.get(slug='academy-tsg')
    lead_pipeline = Pipeline.objects.get(workspace=ws, kind='lead')
    assert lead_pipeline.name == 'Входящие'
    stages = Stage.objects.filter(pipeline=lead_pipeline)
    assert stages.count() == 5
    assert stages.filter(semantic='converted').exists()
    assert stages.filter(semantic='lost').exists()


@pytest.mark.django_db
def test_seed_bitrix_demo_clients():
    call_command('seed_bitrix_demo')
    ws = Workspace.objects.get(slug='academy-tsg')
    assert Client.objects.filter(workspace=ws).count() >= 10
    assert Client.objects.filter(workspace=ws).count() == 15
    # All clients have industry and country set
    assert Client.objects.filter(workspace=ws, industry='Real estate').count() == 15
    assert Client.objects.filter(workspace=ws, country='RU').count() == 15


@pytest.mark.django_db
def test_seed_bitrix_demo_deals():
    call_command('seed_bitrix_demo')
    ws = Workspace.objects.get(slug='academy-tsg')
    assert Deal.objects.filter(workspace=ws).count() >= 15
    # At least 2 per pipeline (7 pipelines * 2 = 14 minimum)
    for pipeline in Pipeline.objects.filter(workspace=ws, kind='deal'):
        assert Deal.objects.filter(workspace=ws, pipeline=pipeline).count() >= 2, \
            f"Pipeline '{pipeline.name}' has fewer than 2 deals"


@pytest.mark.django_db
def test_seed_bitrix_demo_leads():
    call_command('seed_bitrix_demo')
    ws = Workspace.objects.get(slug='academy-tsg')
    assert Lead.objects.filter(workspace=ws).count() >= 30
    assert Lead.objects.filter(workspace=ws).count() == 50
    # Some leads have converted_at set
    assert Lead.objects.filter(workspace=ws, converted_at__isnull=False).exists()
    # Some leads have converted_client set
    assert Lead.objects.filter(workspace=ws, converted_client__isnull=False).exists()


@pytest.mark.django_db
def test_seed_bitrix_demo_custom_fields():
    call_command('seed_bitrix_demo')
    ws = Workspace.objects.get(slug='academy-tsg')
    # 5 custom field defs on deal
    assert CustomFieldDef.objects.filter(workspace=ws, entity='deal').count() == 5
    # 2 custom field defs on lead
    assert CustomFieldDef.objects.filter(workspace=ws, entity='lead').count() == 2
    # Required field exists
    assert CustomFieldDef.objects.filter(
        workspace=ws, entity='deal', code='inn', required=True
    ).exists()
    # Enum field has options
    am_field = CustomFieldDef.objects.get(workspace=ws, entity='deal', code='accounting_method')
    assert am_field.type == 'enum'
    assert len(am_field.options) == 3


@pytest.mark.django_db
def test_seed_bitrix_demo_dictionaries():
    call_command('seed_bitrix_demo')
    ws = Workspace.objects.get(slug='academy-tsg')
    assert Source.objects.filter(workspace=ws).count() == 5
    assert LostReason.objects.filter(workspace=ws).count() == 5


@pytest.mark.django_db
def test_seed_bitrix_demo_users():
    call_command('seed_bitrix_demo')
    from django.contrib.auth import get_user_model
    from apps.workspaces.models import Membership
    User = get_user_model()
    ws = Workspace.objects.get(slug='academy-tsg')
    assert Membership.objects.filter(workspace=ws).count() == 3
    # Owner exists
    assert Membership.objects.filter(workspace=ws, role='owner').count() == 1
    # Owner can authenticate
    owner = User.objects.get(email='owner@academy-tsg.local')
    assert owner.check_password('demo1234')


@pytest.mark.django_db
def test_seed_bitrix_demo_idempotent():
    call_command('seed_bitrix_demo')
    count_before = Client.objects.filter(workspace__slug='academy-tsg').count()
    deal_count_before = Deal.objects.filter(workspace__slug='academy-tsg').count()
    call_command('seed_bitrix_demo')  # second run — must skip
    count_after = Client.objects.filter(workspace__slug='academy-tsg').count()
    deal_count_after = Deal.objects.filter(workspace__slug='academy-tsg').count()
    assert count_before == count_after  # no duplication
    assert deal_count_before == deal_count_after


@pytest.mark.django_db
def test_seed_bitrix_demo_reset():
    call_command('seed_bitrix_demo')
    ws1 = Workspace.objects.get(slug='academy-tsg')
    call_command('seed_bitrix_demo', '--reset')
    ws2 = Workspace.objects.get(slug='academy-tsg')
    # New workspace id after reset
    assert ws1.id != ws2.id
    # Same data counts after reset
    assert Client.objects.filter(workspace=ws2).count() == 15
    assert Lead.objects.filter(workspace=ws2).count() == 50
