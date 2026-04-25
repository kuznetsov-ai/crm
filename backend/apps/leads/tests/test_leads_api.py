import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.workspaces.models import Workspace, Membership
from apps.leads.models import Lead
from apps.pipelines.models import Pipeline, Stage
from apps.users.models import Role
from apps.clients.models import Client

User = get_user_model()


@pytest.fixture
def workspace(db):
    ws, _ = Workspace.objects.get_or_create(slug='idev', defaults={'name': 'iDev', 'is_active': True})
    return ws


@pytest.fixture
def manager(workspace):
    role, _ = Role.objects.get_or_create(
        name='LM-API',
        defaults={'preset': Role.Preset.SALES_MANAGER, 'can_manage_deals': True, 'can_manage_clients': True},
    )
    u, _ = User.objects.get_or_create(
        email='leadapi@idev.team',
        defaults={'first_name': 'Lead', 'last_name': 'API', 'role': role},
    )
    if not u.has_usable_password():
        u.set_password('pass')
        u.save()
    Membership.objects.get_or_create(workspace=workspace, user=u, defaults={'role': Membership.Role.MEMBER})
    u.current_workspace = workspace
    u.save(update_fields=['current_workspace'])
    return u


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def lead(workspace):
    return Lead.objects.create(
        title='Test Lead',
        first_name='Ivan',
        last_name='Petrov',
        phone='+7999',
        email='ivan@example.com',
        company_name='Example Corp',
        workspace=workspace,
    )


@pytest.mark.django_db
def test_lead_list(api_client, manager, workspace, lead):
    api_client.force_authenticate(user=manager)
    r = api_client.get('/api/leads/')
    assert r.status_code == 200
    assert r.data['count'] >= 1


@pytest.mark.django_db
def test_lead_create(api_client, manager):
    api_client.force_authenticate(user=manager)
    r = api_client.post('/api/leads/', {
        'title': 'New Lead',
        'first_name': 'Anna',
        'company_name': 'Corp',
        'email': 'anna@corp.com',
    }, format='json')
    assert r.status_code == 201
    assert r.data['title'] == 'New Lead'


@pytest.mark.django_db
def test_lead_update(api_client, manager, lead):
    api_client.force_authenticate(user=manager)
    r = api_client.patch(f'/api/leads/{lead.pk}/', {'title': 'Updated'}, format='json')
    assert r.status_code == 200
    assert r.data['title'] == 'Updated'


@pytest.mark.django_db
def test_lead_delete(api_client, manager, lead):
    api_client.force_authenticate(user=manager)
    r = api_client.delete(f'/api/leads/{lead.pk}/')
    assert r.status_code == 204


@pytest.mark.django_db
def test_lead_kanban(api_client, manager, workspace, lead):
    api_client.force_authenticate(user=manager)
    r = api_client.get('/api/leads/kanban/')
    assert r.status_code == 200
    assert isinstance(r.data, dict)


@pytest.mark.django_db
def test_lead_history(api_client, manager, lead):
    api_client.force_authenticate(user=manager)
    r = api_client.get(f'/api/leads/{lead.pk}/history/')
    assert r.status_code == 200
    assert isinstance(r.data, list)


@pytest.mark.django_db
def test_lead_convert_happy_path(api_client, manager, workspace, lead):
    """Convert lead: creates client, contact, deal. Returns 200."""
    api_client.force_authenticate(user=manager)
    r = api_client.post(f'/api/leads/{lead.pk}/convert/', {
        'create_client': True,
        'create_contact': True,
        'create_deal': True,
    }, format='json')
    assert r.status_code == 200
    assert r.data['client_id'] is not None
    assert r.data['contact_id'] is not None
    assert r.data['deal_id'] is not None
    lead.refresh_from_db()
    assert lead.converted_at is not None
    assert lead.converted_client_id == r.data['client_id']
    assert lead.converted_deal_id == r.data['deal_id']


@pytest.mark.django_db
def test_lead_convert_idempotent_409(api_client, manager, workspace, lead):
    """Second convert call returns 409."""
    api_client.force_authenticate(user=manager)
    r1 = api_client.post(f'/api/leads/{lead.pk}/convert/', {
        'create_client': True,
        'create_contact': False,
        'create_deal': False,
    }, format='json')
    assert r1.status_code == 200

    r2 = api_client.post(f'/api/leads/{lead.pk}/convert/', {
        'create_client': True,
        'create_contact': False,
        'create_deal': False,
    }, format='json')
    assert r2.status_code == 409


@pytest.mark.django_db
def test_lead_convert_existing_client(api_client, manager, workspace, lead):
    """Convert with existing client_id uses that client."""
    existing_client = Client.objects.create(name='Existing Corp', workspace=workspace)
    api_client.force_authenticate(user=manager)
    r = api_client.post(f'/api/leads/{lead.pk}/convert/', {
        'create_client': False,
        'client_id': existing_client.id,
        'create_contact': False,
        'create_deal': False,
    }, format='json')
    assert r.status_code == 200
    assert r.data['client_id'] == existing_client.id


@pytest.mark.django_db
def test_lead_convert_no_client_400(api_client, manager, workspace, lead):
    """Convert without client_id and create_client=False returns 400."""
    api_client.force_authenticate(user=manager)
    r = api_client.post(f'/api/leads/{lead.pk}/convert/', {
        'create_client': False,
        'create_contact': False,
        'create_deal': False,
    }, format='json')
    assert r.status_code == 400


@pytest.mark.django_db
def test_lead_serializer_nested_fields(api_client, manager, lead):
    api_client.force_authenticate(user=manager)
    r = api_client.get(f'/api/leads/{lead.pk}/')
    assert r.status_code == 200
    assert 'stage_name' in r.data
    assert 'stage_semantic' in r.data
    assert 'pipeline_name' in r.data
