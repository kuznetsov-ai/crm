import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership
from apps.clients.models import Client
from apps.deals.models import Deal
from apps.pipelines.models import Pipeline, Stage

User = get_user_model()


@pytest.fixture
def auth(db):
    idev = Workspace.objects.get(slug='idev')
    u = User.objects.create_user(email='x@e.com', password='pw')
    Membership.objects.create(workspace=idev, user=u, role='admin')
    u.current_workspace = idev
    u.save()
    c = APIClient()
    c.force_authenticate(user=u)
    return c, idev


@pytest.mark.django_db
def test_patch_deal_to_lost_without_reason_is_400(auth):
    c, idev = auth
    cl = Client.objects.create(name='C', workspace=idev)
    d = Deal.objects.create(title='T', client=cl, workspace=idev, status='new_lead')
    p = Pipeline.objects.get(workspace=idev, name='Default sales')
    lost = Stage.objects.get(pipeline=p, code='lost')
    resp = c.patch(f'/api/deals/{d.id}/', {'stage': lost.id},
                   format='json', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 400, resp.data
    assert 'lost_reason' in resp.data


@pytest.mark.django_db
def test_patch_deal_to_lost_with_reason_ok(auth):
    c, idev = auth
    cl = Client.objects.create(name='C', workspace=idev)
    d = Deal.objects.create(title='T', client=cl, workspace=idev, status='new_lead')
    p = Pipeline.objects.get(workspace=idev, name='Default sales')
    lost = Stage.objects.get(pipeline=p, code='lost')
    from apps.dictionaries.models import LostReason
    r = LostReason.objects.get(workspace=idev, code='no_budget')
    resp = c.patch(f'/api/deals/{d.id}/',
                   {'stage': lost.id, 'lost_reason': r.id, 'lost_comment': 'price too high'},
                   format='json', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200, resp.data
