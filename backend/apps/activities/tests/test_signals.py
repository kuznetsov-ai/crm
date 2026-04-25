"""Tests that StageChange creates an Activity via signal."""
import pytest
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace
from apps.pipelines.models import Pipeline, Stage, StageChange
from apps.activities.models import Activity

User = get_user_model()


@pytest.fixture
def workspace(db):
    ws, _ = Workspace.objects.get_or_create(slug='idev', defaults={'name': 'iDev', 'is_active': True})
    return ws


@pytest.fixture
def pipeline(workspace):
    p, _ = Pipeline.objects.get_or_create(
        workspace=workspace, kind='deal', name='Test Pipeline',
        defaults={'is_default': False, 'order': 99},
    )
    return p


@pytest.fixture
def stage_from(pipeline):
    s, _ = Stage.objects.get_or_create(
        pipeline=pipeline, code='new_lead',
        defaults={'name': 'New Lead', 'order': 0},
    )
    return s


@pytest.fixture
def stage_to(pipeline):
    s, _ = Stage.objects.get_or_create(
        pipeline=pipeline, code='discovery',
        defaults={'name': 'Discovery', 'order': 1},
    )
    return s


@pytest.mark.django_db
def test_stage_change_creates_activity(workspace, stage_from, stage_to):
    """Creating a StageChange must produce a paired Activity(type=stage_change)."""
    before_count = Activity.objects.filter(type='stage_change').count()

    sc = StageChange.objects.create(
        workspace=workspace,
        entity_type='deal',
        entity_id=42,
        from_stage=stage_from,
        to_stage=stage_to,
    )

    after_count = Activity.objects.filter(type='stage_change').count()
    assert after_count == before_count + 1

    act = Activity.objects.filter(type='stage_change', entity_id=42).last()
    assert act is not None
    assert act.entity == 'deal'
    assert act.workspace_id == workspace.pk
    assert act.meta['from_stage_id'] == stage_from.pk
    assert act.meta['to_stage_id'] == stage_to.pk
    assert act.meta['from_name'] == stage_from.name
    assert act.meta['to_name'] == stage_to.name
    assert act.meta['from_code'] == stage_from.code
    assert act.meta['to_code'] == stage_to.code


@pytest.mark.django_db
def test_stage_change_null_from_stage(workspace, stage_to):
    """StageChange with no from_stage (initial assignment) also creates an Activity."""
    before_count = Activity.objects.filter(type='stage_change').count()

    StageChange.objects.create(
        workspace=workspace,
        entity_type='deal',
        entity_id=99,
        from_stage=None,
        to_stage=stage_to,
    )

    after_count = Activity.objects.filter(type='stage_change').count()
    assert after_count == before_count + 1

    act = Activity.objects.filter(type='stage_change', entity_id=99).last()
    assert act.meta['from_stage_id'] is None
    assert act.meta['from_name'] is None


@pytest.mark.django_db
def test_stage_change_update_does_not_create_activity(workspace, stage_from, stage_to):
    """Updating (not creating) a StageChange must NOT produce a new Activity."""
    sc = StageChange.objects.create(
        workspace=workspace, entity_type='deal', entity_id=77,
        from_stage=stage_from, to_stage=stage_to,
    )
    before_count = Activity.objects.filter(type='stage_change').count()
    # Trigger post_save with created=False
    sc.save()
    after_count = Activity.objects.filter(type='stage_change').count()
    assert after_count == before_count
