import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership
from apps.clients.models import Client
from apps.custom_fields.models import CustomFieldDef, Entity, FieldType

User = get_user_model()


@pytest.fixture
def setup(db):
    idev = Workspace.objects.get(slug='idev')
    u = User.objects.create_user(email='cf_client_tester@e.com', password='pw')
    Membership.objects.create(workspace=idev, user=u, role='admin')
    u.current_workspace = idev
    u.save()
    client_obj = Client.objects.create(
        name='CF Client', assigned_to=u, created_by=u, workspace=idev
    )
    c = APIClient()
    c.force_authenticate(user=u)
    return c, idev, client_obj


@pytest.mark.django_db
def test_client_detail_has_custom_fields(setup):
    c, idev, client_obj = setup
    resp = c.get(f'/api/clients/{client_obj.pk}/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    assert 'custom_fields' in resp.data
    assert isinstance(resp.data['custom_fields'], dict)


@pytest.mark.django_db
def test_client_patch_custom_fields(setup):
    c, idev, client_obj = setup
    CustomFieldDef.objects.create(
        workspace=idev, entity=Entity.CLIENT, code='vip_notes', label='VIP Notes',
        type=FieldType.TEXT,
    )
    resp = c.patch(
        f'/api/clients/{client_obj.pk}/',
        {'custom_fields': {'vip_notes': 'Priority customer'}},
        format='json',
        HTTP_X_WORKSPACE_SLUG='idev',
    )
    assert resp.status_code == 200
    assert resp.data['custom_fields']['vip_notes'] == 'Priority customer'


@pytest.mark.django_db
def test_client_list_does_not_have_custom_fields(setup):
    c, idev, _ = setup
    resp = c.get('/api/clients/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    data = resp.data
    results = data.get('results', data) if isinstance(data, dict) else data
    if results:
        # List serializer should NOT have custom_fields (perf)
        assert 'custom_fields' not in results[0]
