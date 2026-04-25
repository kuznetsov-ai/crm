import pytest
from django.db import IntegrityError
from apps.workspaces.models import Workspace
from apps.pipelines.models import Pipeline, Stage, StageChange


@pytest.fixture
def ws(db):
    return Workspace.objects.get(slug='idev')


@pytest.mark.django_db
def test_pipeline_str(ws):
    p = Pipeline.objects.create(workspace=ws, kind=Pipeline.Kind.DEAL, name='Main')
    assert str(p) == 'Main'


@pytest.mark.django_db
def test_pipeline_unique_per_workspace_kind_name(ws):
    Pipeline.objects.create(workspace=ws, kind=Pipeline.Kind.DEAL, name='Main')
    with pytest.raises(IntegrityError):
        Pipeline.objects.create(workspace=ws, kind=Pipeline.Kind.DEAL, name='Main')


@pytest.mark.django_db
def test_stage_unique_per_pipeline_code(ws):
    p = Pipeline.objects.create(workspace=ws, kind=Pipeline.Kind.DEAL, name='A')
    Stage.objects.create(pipeline=p, name='New', code='new', order=0)
    with pytest.raises(IntegrityError):
        Stage.objects.create(pipeline=p, name='Duplicate', code='new', order=1)


@pytest.mark.django_db
def test_stage_semantic_choices(ws):
    p = Pipeline.objects.create(workspace=ws, kind=Pipeline.Kind.DEAL, name='A')
    s = Stage.objects.create(pipeline=p, name='Won', code='won',
                             semantic=Stage.Semantic.WON, order=0)
    assert s.get_semantic_display() == 'Выиграно'


@pytest.mark.django_db
def test_stage_ordering(ws):
    p = Pipeline.objects.create(workspace=ws, kind=Pipeline.Kind.DEAL, name='A')
    Stage.objects.create(pipeline=p, name='A', code='a', order=2)
    Stage.objects.create(pipeline=p, name='B', code='b', order=0)
    Stage.objects.create(pipeline=p, name='C', code='c', order=1)
    assert [s.code for s in p.stages.all()] == ['b', 'c', 'a']


@pytest.mark.django_db
def test_stagechange_created(ws):
    p = Pipeline.objects.create(workspace=ws, kind=Pipeline.Kind.DEAL, name='A')
    s1 = Stage.objects.create(pipeline=p, name='New', code='new', order=0)
    s2 = Stage.objects.create(pipeline=p, name='Done', code='done',
                              semantic=Stage.Semantic.WON, order=1)
    ch = StageChange.objects.create(
        workspace=ws, entity_type='deal', entity_id=1, from_stage=s1, to_stage=s2
    )
    assert ch.from_stage == s1 and ch.to_stage == s2
