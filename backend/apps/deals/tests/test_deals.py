import pytest
from django.contrib.auth import get_user_model
from apps.clients.models import Client
from apps.deals.models import Deal, DealNote
from apps.users.models import Role
from apps.workspaces.models import Workspace

User = get_user_model()

@pytest.fixture
def workspace(db):
    ws, _ = Workspace.objects.get_or_create(slug='idev', defaults={'name': 'iDev', 'is_active': True})
    return ws

@pytest.fixture
def manager(workspace):
    role = Role.objects.create(name='SM2', preset=Role.Preset.SALES_MANAGER,
                                can_manage_deals=True, can_manage_clients=True)
    from apps.workspaces.models import Membership
    u = User.objects.create_user(email='dm@idev.team', password='pass',
                                  first_name='Deal', last_name='Manager', role=role)
    Membership.objects.get_or_create(workspace=workspace, user=u, defaults={'role': Membership.Role.MEMBER})
    u.current_workspace = workspace
    u.save(update_fields=['current_workspace'])
    return u

@pytest.fixture
def client_obj(manager, workspace):
    return Client.objects.create(name='Deal Client', assigned_to=manager, created_by=manager, workspace=workspace)

@pytest.mark.django_db
def test_deal_creation(manager, client_obj, workspace):
    deal = Deal.objects.create(
        title='Python Dev x3', client=client_obj,
        assigned_to=manager, created_by=manager,
        status=Deal.Status.NEW_LEAD, value_usd=15000, team_size_needed=3,
        workspace=workspace,
    )
    assert str(deal) == 'Python Dev x3'
    assert deal.status == Deal.Status.NEW_LEAD

@pytest.mark.django_db
def test_deal_status_choices():
    statuses = [s[0] for s in Deal.Status.choices]
    for s in ['new_lead', 'discovery', 'proposal', 'negotiation', 'signed', 'active', 'closed', 'lost']:
        assert s in statuses

@pytest.mark.django_db
def test_deal_note(manager, client_obj, workspace):
    deal = Deal.objects.create(title='Test', client=client_obj, assigned_to=manager, created_by=manager, workspace=workspace)
    note = DealNote.objects.create(deal=deal, author=manager, text='First contact done', workspace=workspace)
    assert note.is_deleted is False
    note.is_deleted = True
    note.save()
    assert DealNote.objects.filter(is_deleted=False).count() == 0

from rest_framework.test import APIClient

@pytest.fixture
def api_client():
    return APIClient()

@pytest.mark.django_db
def test_deal_list(api_client, manager, client_obj, workspace):
    Deal.objects.create(title='A', client=client_obj, assigned_to=manager, created_by=manager, workspace=workspace)
    Deal.objects.create(title='B', client=client_obj, assigned_to=manager, created_by=manager, workspace=workspace)
    api_client.force_authenticate(user=manager)
    r = api_client.get('/api/deals/')
    assert r.status_code == 200
    assert r.data['count'] == 2

@pytest.mark.django_db
def test_deal_create(api_client, manager, client_obj):
    api_client.force_authenticate(user=manager)
    r = api_client.post('/api/deals/', {
        'title': 'New', 'client_id': client_obj.pk, 'status': 'new_lead', 'value_usd': '5000.00'
    }, format='json')
    assert r.status_code == 201

@pytest.mark.django_db
def test_deal_reorder(api_client, manager, client_obj, workspace):
    d1 = Deal.objects.create(title='D1', client=client_obj, assigned_to=manager, created_by=manager, order=0, workspace=workspace)
    d2 = Deal.objects.create(title='D2', client=client_obj, assigned_to=manager, created_by=manager, order=1, workspace=workspace)
    api_client.force_authenticate(user=manager)
    r = api_client.post('/api/deals/reorder/', [{'id': d2.pk, 'order': 0}, {'id': d1.pk, 'order': 1}], format='json')
    assert r.status_code == 200
    d1.refresh_from_db(); d2.refresh_from_db()
    assert d1.order == 1; assert d2.order == 0

@pytest.mark.django_db
def test_deal_note_add(api_client, manager, client_obj, workspace):
    deal = Deal.objects.create(title='N', client=client_obj, assigned_to=manager, created_by=manager, workspace=workspace)
    api_client.force_authenticate(user=manager)
    r = api_client.post(f'/api/deals/{deal.pk}/notes/', {'text': 'Called'}, format='json')
    assert r.status_code == 201
    assert r.data['text'] == 'Called'

@pytest.mark.django_db
def test_deal_filter_status(api_client, manager, client_obj, workspace):
    Deal.objects.create(title='A', client=client_obj, assigned_to=manager, created_by=manager, status='active', workspace=workspace)
    Deal.objects.create(title='B', client=client_obj, assigned_to=manager, created_by=manager, status='new_lead', workspace=workspace)
    api_client.force_authenticate(user=manager)
    r = api_client.get('/api/deals/?status=active')
    assert r.data['count'] == 1
