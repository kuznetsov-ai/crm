"""Tests for the Activity API."""
import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership
from apps.users.models import Role
from apps.activities.models import Activity

User = get_user_model()


@pytest.fixture
def workspace(db):
    ws, _ = Workspace.objects.get_or_create(slug='idev', defaults={'name': 'iDev', 'is_active': True})
    return ws


@pytest.fixture
def user(workspace):
    role, _ = Role.objects.get_or_create(
        name='SM_act',
        defaults={'preset': Role.Preset.SALES_MANAGER,
                  'can_manage_clients': True, 'can_manage_deals': True},
    )
    u, created = User.objects.get_or_create(
        email='act_api_user@idev.team',
        defaults={'first_name': 'Act', 'last_name': 'API', 'role': role},
    )
    Membership.objects.get_or_create(workspace=workspace, user=u,
                                      defaults={'role': Membership.Role.MEMBER})
    u.current_workspace = workspace
    u.save(update_fields=['current_workspace'])
    return u


@pytest.fixture
def api_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


# ── List / filter ────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_list_activities_empty(api_client, workspace):
    resp = api_client.get('/api/activities/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200


@pytest.mark.django_db
def test_list_filter_by_entity(api_client, workspace, user):
    Activity.objects.create(workspace=workspace, type='note', entity='deal', entity_id=1, body='d1', author=user)
    Activity.objects.create(workspace=workspace, type='note', entity='client', entity_id=1, body='c1', author=user)

    resp = api_client.get('/api/activities/?entity=deal', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    results = resp.data.get('results', resp.data)
    assert all(r['entity'] == 'deal' for r in results)


@pytest.mark.django_db
def test_list_filter_by_entity_id(api_client, workspace, user):
    Activity.objects.create(workspace=workspace, type='note', entity='deal', entity_id=10, body='deal10')
    Activity.objects.create(workspace=workspace, type='note', entity='deal', entity_id=20, body='deal20')

    resp = api_client.get('/api/activities/?entity=deal&entity_id=10', HTTP_X_WORKSPACE_SLUG='idev')
    results = resp.data.get('results', resp.data)
    assert all(r['entity_id'] == 10 for r in results)


@pytest.mark.django_db
def test_list_filter_by_types_csv(api_client, workspace, user):
    Activity.objects.create(workspace=workspace, type='note', entity='deal', entity_id=1, body='n')
    Activity.objects.create(workspace=workspace, type='call', entity='deal', entity_id=1, body='c')
    Activity.objects.create(workspace=workspace, type='meeting', entity='deal', entity_id=1, body='m')

    resp = api_client.get('/api/activities/?entity=deal&entity_id=1&types=note,call',
                          HTTP_X_WORKSPACE_SLUG='idev')
    results = resp.data.get('results', resp.data)
    returned_types = {r['type'] for r in results}
    assert 'meeting' not in returned_types
    assert 'note' in returned_types or 'call' in returned_types


# ── Create ───────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_create_activity(api_client, workspace):
    resp = api_client.post('/api/activities/', {
        'type': 'note',
        'entity': 'deal',
        'entity_id': 5,
        'body': 'Hello',
    }, format='json', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 201
    assert resp.data['type'] == 'note'
    assert resp.data['body'] == 'Hello'


@pytest.mark.django_db
def test_create_task_activity(api_client, workspace):
    resp = api_client.post('/api/activities/', {
        'type': 'task',
        'entity': 'deal',
        'entity_id': 7,
        'subject': 'Send proposal',
        'body': 'Include pricing',
        'due_at': '2026-05-01T10:00:00Z',
    }, format='json', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 201
    assert resp.data['subject'] == 'Send proposal'


# ── Update / Delete ──────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_patch_activity(api_client, workspace, user):
    a = Activity.objects.create(workspace=workspace, type='note', entity='deal', entity_id=1, body='old')
    resp = api_client.patch(f'/api/activities/{a.pk}/', {'body': 'new'},
                             format='json', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    assert resp.data['body'] == 'new'


@pytest.mark.django_db
def test_delete_activity(api_client, workspace, user):
    a = Activity.objects.create(workspace=workspace, type='note', entity='deal', entity_id=1, body='bye')
    resp = api_client.delete(f'/api/activities/{a.pk}/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 204
    assert not Activity.objects.filter(pk=a.pk).exists()


# ── Custom actions ───────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_complete_action(api_client, workspace, user):
    a = Activity.objects.create(workspace=workspace, type='task', entity='deal', entity_id=1, subject='Do it')
    assert a.completed_at is None
    resp = api_client.post(f'/api/activities/{a.pk}/complete/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    a.refresh_from_db()
    assert a.completed_at is not None


@pytest.mark.django_db
def test_pin_action_toggles(api_client, workspace, user):
    a = Activity.objects.create(workspace=workspace, type='note', entity='deal', entity_id=1, body='pin me')
    assert a.is_pinned is False

    resp = api_client.post(f'/api/activities/{a.pk}/pin/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    a.refresh_from_db()
    assert a.is_pinned is True

    resp2 = api_client.post(f'/api/activities/{a.pk}/pin/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp2.status_code == 200
    a.refresh_from_db()
    assert a.is_pinned is False
