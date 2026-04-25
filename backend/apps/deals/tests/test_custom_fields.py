import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership
from apps.clients.models import Client
from apps.deals.models import Deal
from apps.custom_fields.models import CustomFieldDef, Entity, FieldType

User = get_user_model()


@pytest.fixture
def setup(db):
    idev = Workspace.objects.get(slug='idev')
    u = User.objects.create_user(email='cf_deal_tester@e.com', password='pw')
    Membership.objects.create(workspace=idev, user=u, role='admin')
    u.current_workspace = idev
    u.save()
    client_obj = Client.objects.create(
        name='CF Test Client', assigned_to=u, created_by=u, workspace=idev
    )
    deal = Deal.objects.create(
        title='CF Test Deal', client=client_obj,
        assigned_to=u, created_by=u,
        status='new_lead', workspace=idev,
    )
    c = APIClient()
    c.force_authenticate(user=u)
    return c, idev, deal


@pytest.mark.django_db
def test_deal_detail_has_custom_fields(setup):
    c, idev, deal = setup
    resp = c.get(f'/api/deals/{deal.pk}/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    assert 'custom_fields' in resp.data
    assert isinstance(resp.data['custom_fields'], dict)


@pytest.mark.django_db
def test_deal_patch_custom_fields(setup):
    c, idev, deal = setup
    CustomFieldDef.objects.create(
        workspace=idev, entity=Entity.DEAL, code='inn_test', label='ИНН',
        type=FieldType.STRING,
    )
    resp = c.patch(
        f'/api/deals/{deal.pk}/',
        {'custom_fields': {'inn_test': '7707083893'}},
        format='json',
        HTTP_X_WORKSPACE_SLUG='idev',
    )
    assert resp.status_code == 200
    assert resp.data['custom_fields']['inn_test'] == '7707083893'


@pytest.mark.django_db
def test_deal_patch_enum_invalid_returns_400(setup):
    c, idev, deal = setup
    CustomFieldDef.objects.create(
        workspace=idev, entity=Entity.DEAL, code='prio_test', label='Priority',
        type=FieldType.ENUM,
        options=[{'code': 'high', 'label': 'High'}, {'code': 'low', 'label': 'Low'}],
    )
    resp = c.patch(
        f'/api/deals/{deal.pk}/',
        {'custom_fields': {'prio_test': 'invalid_code'}},
        format='json',
        HTTP_X_WORKSPACE_SLUG='idev',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_deal_get_shows_cf_after_patch(setup):
    c, idev, deal = setup
    CustomFieldDef.objects.create(
        workspace=idev, entity=Entity.DEAL, code='tag_test', label='Tag',
        type=FieldType.STRING,
    )
    c.patch(
        f'/api/deals/{deal.pk}/',
        {'custom_fields': {'tag_test': 'priority_client'}},
        format='json',
        HTTP_X_WORKSPACE_SLUG='idev',
    )
    resp = c.get(f'/api/deals/{deal.pk}/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.data['custom_fields']['tag_test'] == 'priority_client'
