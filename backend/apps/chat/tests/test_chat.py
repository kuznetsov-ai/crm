import pytest
from django.contrib.auth import get_user_model
from apps.chat.models import ChatChannel, ChatMessage
from apps.users.models import Role
from apps.workspaces.models import Workspace
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def workspace(db):
    return Workspace.objects.get(slug='idev')


@pytest.fixture
def user1(db, workspace):
    from apps.workspaces.models import Membership
    r = Role.objects.create(name='U1R', preset=Role.Preset.SALES_MANAGER)
    u = User.objects.create_user(email='u1@idev.team', password='pass', first_name='User', last_name='One', role=r)
    Membership.objects.get_or_create(workspace=workspace, user=u, defaults={'role': Membership.Role.MEMBER})
    u.current_workspace = workspace
    u.save(update_fields=['current_workspace'])
    return u


@pytest.fixture
def user2(db, workspace):
    from apps.workspaces.models import Membership
    r = Role.objects.create(name='U2R', preset=Role.Preset.VIEWER)
    u = User.objects.create_user(email='u2@idev.team', password='pass', first_name='User', last_name='Two', role=r)
    Membership.objects.get_or_create(workspace=workspace, user=u, defaults={'role': Membership.Role.MEMBER})
    u.current_workspace = workspace
    u.save(update_fields=['current_workspace'])
    return u


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
def test_create_group_channel(api_client, user1, user2):
    api_client.force_authenticate(user=user1)
    r = api_client.post('/api/chat/', {'name': 'Team', 'channel_type': 'group', 'member_ids': [user2.pk]}, format='json')
    assert r.status_code == 201
    assert r.data['channel_type'] == 'group'


@pytest.mark.django_db
def test_direct_channel(api_client, user1, user2):
    api_client.force_authenticate(user=user1)
    r = api_client.post('/api/chat/direct/', {'user_id': user2.pk}, format='json')
    assert r.status_code in (200, 201)
    # calling again returns same channel
    r2 = api_client.post('/api/chat/direct/', {'user_id': user2.pk}, format='json')
    assert r2.data['id'] == r.data['id']


@pytest.mark.django_db
def test_channel_list_only_members(api_client, user1, user2, workspace):
    ch = ChatChannel.objects.create(name='Private', channel_type='group', workspace=workspace)
    ch.members.add(user1)
    api_client.force_authenticate(user=user2)
    r = api_client.get('/api/chat/')
    results = r.data.get('results', r.data)
    assert all(c['id'] != ch.id for c in results)


@pytest.mark.django_db
def test_message_list(api_client, user1, user2, workspace):
    ch = ChatChannel.objects.create(name='Test', workspace=workspace)
    ch.members.add(user1, user2)
    ChatMessage.objects.create(channel=ch, author=user1, text='Hello', workspace=workspace)
    ChatMessage.objects.create(channel=ch, author=user2, text='World', workspace=workspace)
    api_client.force_authenticate(user=user1)
    r = api_client.get(f'/api/chat/{ch.pk}/messages/')
    assert r.status_code == 200
    results = r.data.get('results', r.data)
    assert len(results) == 2


@pytest.mark.django_db
def test_message_list_non_member_blocked(api_client, user1, user2, workspace):
    ch = ChatChannel.objects.create(name='Priv', workspace=workspace)
    ch.members.add(user1)
    api_client.force_authenticate(user=user2)
    r = api_client.get(f'/api/chat/{ch.pk}/messages/')
    assert r.status_code == 200
    results = r.data.get('results', r.data)
    assert len(results) == 0  # empty, not 403
