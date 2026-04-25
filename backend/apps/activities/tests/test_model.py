import pytest
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace
from apps.activities.models import Activity

User = get_user_model()


@pytest.fixture
def workspace(db):
    ws, _ = Workspace.objects.get_or_create(slug='idev', defaults={'name': 'iDev', 'is_active': True})
    return ws


@pytest.fixture
def user(workspace):
    u, _ = User.objects.get_or_create(
        email='activity_test@idev.team',
        defaults={'first_name': 'Act', 'last_name': 'User'},
    )
    return u


@pytest.mark.django_db
def test_activity_create(workspace, user):
    a = Activity.objects.create(
        workspace=workspace,
        type=Activity.Type.NOTE,
        entity=Activity.Entity.DEAL,
        entity_id=1,
        body='Test note body',
        author=user,
    )
    assert a.pk is not None
    assert a.type == 'note'
    assert a.entity == 'deal'
    assert a.is_pinned is False
    assert str(a) == 'note on deal/1'


@pytest.mark.django_db
def test_activity_type_choices():
    types = [t[0] for t in Activity.Type.choices]
    assert 'note' in types
    assert 'call' in types
    assert 'stage_change' in types
    assert 'task' in types
    assert 'ai' in types


@pytest.mark.django_db
def test_activity_entity_choices():
    entities = [e[0] for e in Activity.Entity.choices]
    assert 'lead' in entities
    assert 'deal' in entities
    assert 'client' in entities


@pytest.mark.django_db
def test_activity_meta_default(workspace):
    a = Activity.objects.create(
        workspace=workspace,
        type=Activity.Type.TASK,
        entity=Activity.Entity.LEAD,
        entity_id=5,
        subject='Follow up',
    )
    assert a.meta == {}


@pytest.mark.django_db
def test_activity_workspace_manager(workspace):
    """WorkspaceManager.for_workspace() filters correctly."""
    Activity.objects.create(
        workspace=workspace, type='note', entity='client', entity_id=1, body='ws1'
    )
    ws2, _ = Workspace.objects.get_or_create(slug='other', defaults={'name': 'Other', 'is_active': True})
    Activity.objects.create(
        workspace=ws2, type='note', entity='client', entity_id=1, body='ws2'
    )
    qs = Activity.objects.for_workspace(workspace)
    bodies = list(qs.values_list('body', flat=True))
    assert 'ws1' in bodies
    assert 'ws2' not in bodies


@pytest.mark.django_db
def test_activity_pinned_ordering(workspace):
    """Pinned items appear before non-pinned."""
    a1 = Activity.objects.create(workspace=workspace, type='note', entity='deal',
                                  entity_id=1, body='normal')
    a2 = Activity.objects.create(workspace=workspace, type='note', entity='deal',
                                  entity_id=1, body='pinned', is_pinned=True)
    qs = Activity.objects.filter(workspace=workspace).order_by('-is_pinned', '-created_at')
    first = qs.first()
    assert first.pk == a2.pk
