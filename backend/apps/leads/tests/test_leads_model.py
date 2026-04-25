import pytest
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership
from apps.leads.models import Lead
from apps.pipelines.models import Pipeline, Stage
from apps.users.models import Role

User = get_user_model()


@pytest.fixture
def workspace(db):
    ws, _ = Workspace.objects.get_or_create(slug='idev', defaults={'name': 'iDev', 'is_active': True})
    return ws


@pytest.fixture
def manager(workspace):
    role, _ = Role.objects.get_or_create(
        name='LM-Test',
        defaults={'preset': Role.Preset.SALES_MANAGER, 'can_manage_deals': True, 'can_manage_clients': True},
    )
    u, _ = User.objects.get_or_create(
        email='lead.manager@idev.team',
        defaults={'first_name': 'Lead', 'last_name': 'Manager', 'role': role},
    )
    if not u.has_usable_password():
        u.set_password('pass')
        u.save()
    Membership.objects.get_or_create(workspace=workspace, user=u, defaults={'role': Membership.Role.MEMBER})
    u.current_workspace = workspace
    u.save(update_fields=['current_workspace'])
    return u


@pytest.mark.django_db
def test_lead_str(workspace):
    lead = Lead.objects.create(title='Test Lead', workspace=workspace)
    assert str(lead) == 'Test Lead'


@pytest.mark.django_db
def test_lead_default_fields(workspace):
    lead = Lead.objects.create(title='Minimal', workspace=workspace)
    assert lead.first_name == ''
    assert lead.email == ''
    assert lead.converted_at is None
    assert lead.pipeline_id is not None  # signal auto-attaches


@pytest.mark.django_db
def test_lead_signal_auto_pipeline(workspace):
    """New lead gets lead pipeline + first open stage auto-assigned."""
    lead = Lead.objects.create(title='Auto Pipeline', workspace=workspace)
    lead.refresh_from_db()
    assert lead.pipeline is not None
    assert lead.pipeline.kind == 'lead'
    assert lead.stage is not None
    assert lead.stage.semantic == 'open'


@pytest.mark.django_db
def test_lead_pipeline_seeded(workspace):
    """The seed migration creates Входящие pipeline with 5 stages."""
    pipeline = Pipeline.objects.filter(workspace=workspace, kind='lead', name='Входящие').first()
    assert pipeline is not None
    stages = list(pipeline.stages.order_by('order'))
    assert len(stages) == 5
    codes = [s.code for s in stages]
    assert 'new' in codes
    assert 'converted' in codes
    assert 'rejected' in codes
    converted_stage = next(s for s in stages if s.code == 'converted')
    assert converted_stage.semantic == 'converted'
    rejected_stage = next(s for s in stages if s.code == 'rejected')
    assert rejected_stage.semantic == 'lost'


@pytest.mark.django_db
def test_stage_change_on_stage_transition(workspace):
    """Moving lead to different stage creates StageChange record."""
    from apps.pipelines.models import StageChange
    lead = Lead.objects.create(title='Stage Change', workspace=workspace)
    lead.refresh_from_db()

    pipeline = lead.pipeline
    stages = list(pipeline.stages.order_by('order'))
    assert len(stages) >= 2

    first_stage = stages[0]
    second_stage = stages[1]

    # Set to first stage explicitly
    lead.stage = first_stage
    lead.save()

    count_before = StageChange.objects.filter(entity_type='lead', entity_id=lead.id).count()
    lead.stage = second_stage
    lead.save()
    count_after = StageChange.objects.filter(entity_type='lead', entity_id=lead.id).count()
    assert count_after > count_before
