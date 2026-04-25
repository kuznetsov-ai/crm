import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership
from apps.pipelines.models import Pipeline, Stage

User = get_user_model()


@pytest.fixture
def auth_user(db):
    idev = Workspace.objects.get(slug='idev')
    u = User.objects.create_user(email='p@e', password='pw')
    Membership.objects.create(workspace=idev, user=u, role='admin')
    u.current_workspace = idev; u.save()
    return u, idev


def _c(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.django_db
def test_pipelines_list(auth_user):
    u, idev = auth_user
    c = _c(u)
    resp = c.get('/api/pipelines/?kind=deal', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    assert any(p['name'] == 'Default sales' for p in resp.data['results'])


@pytest.mark.django_db
def test_pipeline_stages_nested(auth_user):
    u, idev = auth_user
    c = _c(u)
    p = Pipeline.objects.get(workspace=idev, name='Default sales')
    resp = c.get(f'/api/pipelines/{p.id}/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    assert len(resp.data['stages']) == 8


@pytest.mark.django_db
def test_stages_list_filters_by_pipeline(auth_user):
    u, idev = auth_user
    c = _c(u)
    p = Pipeline.objects.get(workspace=idev, name='Default sales')
    resp = c.get(f'/api/stages/?pipeline={p.id}', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    count = resp.data.get('count') if 'count' in resp.data else len(resp.data.get('results', resp.data))
    # 8 stages in default pipeline
    if 'results' in resp.data:
        assert len(resp.data['results']) == 8
    else:
        assert len(resp.data) == 8


@pytest.mark.django_db
def test_deal_history_endpoint(auth_user):
    from apps.clients.models import Client
    from apps.deals.models import Deal
    u, idev = auth_user
    c = _c(u)
    client_ = Client.objects.create(name='X', workspace=idev)
    d = Deal.objects.create(title='D', client=client_, workspace=idev, status='new_lead')
    d.refresh_from_db()
    p = Pipeline.objects.get(workspace=idev, name='Default sales')
    d.stage = Stage.objects.get(pipeline=p, code='proposal')
    d.status = 'proposal'; d.save()
    resp = c.get(f'/api/deals/{d.id}/history/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    assert len(resp.data) >= 1
    # Most recent change should be to 'proposal'
    assert resp.data[0]['to_stage_code'] == 'proposal'
