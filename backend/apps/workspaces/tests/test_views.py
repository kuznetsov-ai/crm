import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership

User = get_user_model()


@pytest.fixture
def user_with_two_workspaces(db):
    u = User.objects.create_user(email='u@e', password='pw')
    a = Workspace.objects.create(slug='a', name='A')
    b = Workspace.objects.create(slug='b', name='B')
    Membership.objects.create(workspace=a, user=u, role=Membership.Role.MEMBER)
    Membership.objects.create(workspace=b, user=u, role=Membership.Role.OWNER)
    u.current_workspace = a
    u.save()
    return u, a, b


def _auth(client, user):
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
def test_list_returns_only_users_workspaces(user_with_two_workspaces):
    u, a, b = user_with_two_workspaces
    Workspace.objects.create(slug='c', name='C')
    c = APIClient()
    _auth(c, u)
    resp = c.get('/api/workspaces/')
    assert resp.status_code == 200
    slugs = {w['slug'] for w in resp.data['results']}
    assert slugs == {'a', 'b'}


@pytest.mark.django_db
def test_me_endpoint_returns_current_slug(user_with_two_workspaces):
    u, a, b = user_with_two_workspaces
    c = APIClient()
    _auth(c, u)
    resp = c.get('/api/workspaces/me/')
    assert resp.status_code == 200
    assert resp.data['current_workspace_slug'] == 'a'
    assert {w['slug'] for w in resp.data['workspaces']} == {'a', 'b'}


@pytest.mark.django_db
def test_switch_updates_current_workspace(user_with_two_workspaces):
    u, a, b = user_with_two_workspaces
    c = APIClient()
    _auth(c, u)
    resp = c.post('/api/workspaces/switch/', {'slug': 'b'}, format='json')
    assert resp.status_code == 200, resp.data
    u.refresh_from_db()
    assert u.current_workspace == b


@pytest.mark.django_db
def test_switch_rejects_non_member(user_with_two_workspaces):
    u, *_ = user_with_two_workspaces
    Workspace.objects.create(slug='c', name='C')
    c = APIClient()
    _auth(c, u)
    resp = c.post('/api/workspaces/switch/', {'slug': 'c'}, format='json')
    assert resp.status_code == 404
