import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership
from apps.clients.models import Client

User = get_user_model()


@pytest.fixture
def setup(db):
    a = Workspace.objects.get(slug='idev')
    b = Workspace.objects.create(slug='acme', name='Acme')
    u = User.objects.create_user(email='u@e', password='pw')
    Membership.objects.create(workspace=a, user=u, role=Membership.Role.MEMBER)
    Membership.objects.create(workspace=b, user=u, role=Membership.Role.MEMBER)
    Client.objects.create(name='A-Client', workspace=a)
    Client.objects.create(name='B-Client', workspace=b)
    return a, b, u


@pytest.mark.django_db
def test_client_list_scoped_by_header(setup):
    a, b, u = setup
    c = APIClient()
    c.force_authenticate(user=u)
    resp_a = c.get('/api/clients/', HTTP_X_WORKSPACE_SLUG='idev')
    resp_b = c.get('/api/clients/', HTTP_X_WORKSPACE_SLUG='acme')
    names_a = [r['name'] for r in resp_a.data['results']]
    names_b = [r['name'] for r in resp_b.data['results']]
    assert 'A-Client' in names_a and 'B-Client' not in names_a
    assert 'B-Client' in names_b and 'A-Client' not in names_b


@pytest.mark.django_db
def test_client_create_assigns_current_workspace(setup):
    a, b, u = setup
    c = APIClient()
    c.force_authenticate(user=u)
    resp = c.post('/api/clients/', {'name': 'New-in-Acme', 'status': 'lead'},
                  format='json', HTTP_X_WORKSPACE_SLUG='acme')
    assert resp.status_code == 201, resp.data
    created = Client.objects.get(id=resp.data['id'])
    assert created.workspace == b


@pytest.mark.django_db
def test_no_workspace_header_returns_403(setup):
    *_, u = setup
    c = APIClient()
    c.force_authenticate(user=u)
    resp = c.get('/api/clients/')
    assert resp.status_code == 403
