import pytest
from apps.workspaces.models import Workspace
from apps.pipelines.models import Pipeline, Stage, StageChange
from apps.deals.models import Deal
from apps.clients.models import Client


@pytest.fixture
def idev(db):
    return Workspace.objects.get(slug='idev')


@pytest.fixture
def client_(idev):
    return Client.objects.create(name='C', workspace=idev)


@pytest.mark.django_db
def test_new_deal_auto_gets_default_pipeline_and_stage(idev, client_):
    d = Deal.objects.create(title='X', client=client_, workspace=idev, status='proposal')
    d.refresh_from_db()
    assert d.pipeline is not None and d.pipeline.is_default
    assert d.stage is not None and d.stage.code == 'proposal'


@pytest.mark.django_db
def test_stage_change_creates_history_row(idev, client_):
    d = Deal.objects.create(title='X', client=client_, workspace=idev, status='new_lead')
    d.refresh_from_db()
    initial_stage = d.stage
    p = Pipeline.objects.get(workspace=idev, name='Default sales')
    proposal = Stage.objects.get(pipeline=p, code='proposal')
    d.stage = proposal
    d.status = 'proposal'
    d.save()
    ch = StageChange.objects.filter(entity_type='deal', entity_id=d.id).order_by('-at').first()
    assert ch is not None
    assert ch.from_stage == initial_stage
    assert ch.to_stage == proposal


@pytest.mark.django_db
def test_first_save_creates_initial_stage_change(idev, client_):
    d = Deal.objects.create(title='Y', client=client_, workspace=idev, status='discovery')
    changes = StageChange.objects.filter(entity_type='deal', entity_id=d.id)
    # At least one history row should exist (from None → discovery stage).
    assert changes.exists()
