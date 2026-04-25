import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership
from apps.clients.models import Client
from apps.deals.models import Deal

User = get_user_model()


@pytest.fixture
def two_ws(db):
    idev = Workspace.objects.get(slug='idev')
    other = Workspace.objects.create(slug='scope-test', name='Scope Test')
    u = User.objects.create_user(email='scope@e', password='pw')
    Membership.objects.create(workspace=idev, user=u, role='admin')
    Membership.objects.create(workspace=other, user=u, role='admin')
    u.current_workspace = idev
    u.save()
    Client.objects.create(workspace=idev, name='idev-C1')
    Client.objects.create(workspace=idev, name='idev-C2')
    Client.objects.create(workspace=other, name='other-C1')
    for ws in (idev, other):
        c = Client.objects.filter(workspace=ws).first()
        Deal.objects.create(workspace=ws, client=c, title=f'{ws.slug}-d')
    return idev, other, u


@pytest.mark.django_db
def test_dashboard_stats_scoped_to_header(two_ws):
    _, _, u = two_ws
    c = APIClient()
    c.force_authenticate(user=u)
    r1 = c.get('/api/dashboard/stats/', HTTP_X_WORKSPACE_SLUG='idev')
    r2 = c.get('/api/dashboard/stats/', HTTP_X_WORKSPACE_SLUG='scope-test')
    assert r1.status_code == 200
    assert r2.status_code == 200
    # idev has 2 clients (plus any seeded); scope-test has exactly 1
    # Assert counts differ to prove scoping is active.
    idev_clients = r1.data['clients']['total']
    other_clients = r2.data['clients']['total']
    assert idev_clients != other_clients, (
        f'Expected different client counts per workspace, got idev={idev_clients}, scope-test={other_clients}. '
        f'Full responses: idev={r1.data}, scope-test={r2.data}'
    )
