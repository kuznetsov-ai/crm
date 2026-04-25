import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership
from apps.custom_fields.models import CustomFieldDef, Entity, FieldType

User = get_user_model()


@pytest.fixture
def auth_client(db):
    idev = Workspace.objects.get(slug='idev')
    u = User.objects.create_user(email='cf_tester@e.com', password='pw')
    Membership.objects.create(workspace=idev, user=u, role='admin')
    u.current_workspace = idev
    u.save()
    c = APIClient()
    c.force_authenticate(user=u)
    return c, idev


@pytest.mark.django_db
def test_list_defs_empty(auth_client):
    client, _ = auth_client
    resp = client.get('/api/custom-fields/defs/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    data = resp.data
    results = data.get('results', data) if isinstance(data, dict) else data
    assert isinstance(results, list)


@pytest.mark.django_db
def test_create_def(auth_client):
    client, _ = auth_client
    payload = {
        'entity': 'deal',
        'code': 'inn_chairman',
        'label': 'ИНН Председателя',
        'type': 'string',
        'required': False,
    }
    resp = client.post('/api/custom-fields/defs/', payload, format='json',
                       HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 201
    assert resp.data['code'] == 'inn_chairman'
    assert resp.data['entity'] == 'deal'


@pytest.mark.django_db
def test_filter_by_entity(auth_client):
    client, idev = auth_client
    CustomFieldDef.objects.create(workspace=idev, entity=Entity.DEAL, code='f1', label='F1')
    CustomFieldDef.objects.create(workspace=idev, entity=Entity.CLIENT, code='f2', label='F2')
    resp = client.get('/api/custom-fields/defs/?entity=deal', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    data = resp.data
    results = data.get('results', data) if isinstance(data, dict) else data
    assert all(r['entity'] == 'deal' for r in results)


@pytest.mark.django_db
def test_reorder_defs(auth_client):
    client, idev = auth_client
    f1 = CustomFieldDef.objects.create(workspace=idev, entity=Entity.DEAL, code='r1', label='R1', order=0)
    f2 = CustomFieldDef.objects.create(workspace=idev, entity=Entity.DEAL, code='r2', label='R2', order=1)
    # Reverse them
    resp = client.post('/api/custom-fields/defs/reorder/',
                       {'entity': 'deal', 'ids': [f2.pk, f1.pk]},
                       format='json', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    f1.refresh_from_db()
    f2.refresh_from_db()
    assert f2.order == 0
    assert f1.order == 1


@pytest.mark.django_db
def test_workspace_scoping(db):
    """Custom field defs from ws_b should not appear for ws_a member."""
    ws_a = Workspace.objects.get(slug='idev')
    ws_b = Workspace.objects.create(name='Other2', slug='other2')
    CustomFieldDef.objects.create(workspace=ws_b, entity=Entity.DEAL, code='secret', label='Secret')

    u = User.objects.create_user(email='cf_scope@e.com', password='pw')
    Membership.objects.create(workspace=ws_a, user=u, role='admin')
    u.current_workspace = ws_a
    u.save()

    c = APIClient()
    c.force_authenticate(user=u)
    resp = c.get('/api/custom-fields/defs/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    data = resp.data
    results = data.get('results', data) if isinstance(data, dict) else data
    codes = [r['code'] for r in results]
    assert 'secret' not in codes


@pytest.mark.django_db
def test_update_def(auth_client):
    client, idev = auth_client
    f = CustomFieldDef.objects.create(workspace=idev, entity=Entity.LEAD, code='upd', label='Old')
    resp = client.patch(f'/api/custom-fields/defs/{f.pk}/',
                        {'label': 'New Label'},
                        format='json', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 200
    assert resp.data['label'] == 'New Label'


@pytest.mark.django_db
def test_delete_def(auth_client):
    client, idev = auth_client
    f = CustomFieldDef.objects.create(workspace=idev, entity=Entity.CLIENT, code='del', label='Del')
    resp = client.delete(f'/api/custom-fields/defs/{f.pk}/', HTTP_X_WORKSPACE_SLUG='idev')
    assert resp.status_code == 204
    assert not CustomFieldDef.objects.filter(pk=f.pk).exists()
