import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership
from apps.dictionaries.models import Source, LostReason

User = get_user_model()


@pytest.fixture
def auth_client(db):
    idev = Workspace.objects.get(slug='idev')
    u = User.objects.create_user(email='dict_tester@e.com', password='pw')
    Membership.objects.create(workspace=idev, user=u, role='admin')
    u.current_workspace = idev
    u.save()
    c = APIClient()
    c.force_authenticate(user=u)
    return c, idev


@pytest.mark.django_db
def test_sources_list_returns_seeded_entries(auth_client):
    client, idev = auth_client
    resp = client.get('/api/sources/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    data = resp.data
    results = data.get('results', data) if isinstance(data, dict) else data
    codes = {item['code'] for item in results}
    assert codes >= {'ads', 'referral', 'cold_call', 'partner', 'website'}


@pytest.mark.django_db
def test_lost_reasons_list_returns_seeded_entries(auth_client):
    client, idev = auth_client
    resp = client.get('/api/lost-reasons/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    data = resp.data
    results = data.get('results', data) if isinstance(data, dict) else data
    codes = {item['code'] for item in results}
    assert codes >= {'no_budget', 'competitor', 'not_relevant', 'no_contact', 'other'}


@pytest.mark.django_db
def test_sources_workspace_scoping(db):
    """Sources from workspace A should not appear when querying as workspace B member."""
    ws_a = Workspace.objects.get(slug='idev')
    ws_b = Workspace.objects.create(name='Other', slug='other')
    # Source in ws_b not in ws_a
    Source.objects.create(workspace=ws_b, code='only_in_b', name='Only B')

    u = User.objects.create_user(email='scope_tester@e.com', password='pw')
    Membership.objects.create(workspace=ws_a, user=u, role='admin')
    u.current_workspace = ws_a
    u.save()

    c = APIClient()
    c.force_authenticate(user=u)
    resp = c.get('/api/sources/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    data = resp.data
    results = data.get('results', data) if isinstance(data, dict) else data
    codes = {item['code'] for item in results}
    assert 'only_in_b' not in codes


@pytest.mark.django_db
def test_source_create(auth_client):
    client, idev = auth_client
    resp = client.post('/api/sources/', {'code': 'social', 'name': 'Social Media'},
                       format='json', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 201
    assert resp.data['code'] == 'social'


@pytest.mark.django_db
def test_lost_reason_create(auth_client):
    client, idev = auth_client
    resp = client.post('/api/lost-reasons/', {'code': 'test_reject', 'name': 'Test Reject'},
                       format='json', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 201
    assert resp.data['code'] == 'test_reject'
