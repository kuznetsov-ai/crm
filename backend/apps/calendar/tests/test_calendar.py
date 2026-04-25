import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.calendar.models import CalendarEvent
from apps.users.models import Role
from apps.workspaces.models import Workspace, Membership

User = get_user_model()


@pytest.fixture
def user(db):
    ws, _ = Workspace.objects.get_or_create(slug='idev', defaults={'name': 'iDev', 'is_active': True})
    role = Role.objects.create(name='CAL', preset=Role.Preset.SALES_MANAGER)
    u = User.objects.create_user(
        email='cal@idev.team',
        password='pass',
        first_name='Cal',
        last_name='User',
        role=role,
    )
    Membership.objects.get_or_create(workspace=ws, user=u, defaults={'role': Membership.Role.MEMBER})
    u.current_workspace = ws
    u.save(update_fields=['current_workspace'])
    return u


@pytest.fixture
def api_client():
    return APIClient()


@pytest.mark.django_db
def test_create_event_with_offset_roundtrip(api_client, user):
    """Client sends 14:00 Cyprus (+03:00); server stores UTC; API returns a
    datetime that decodes back to 14:00 in the same offset."""
    api_client.force_authenticate(user=user)
    payload = {
        'title': 'Round trip',
        'event_type': 'event',
        'start_datetime': '2026-04-17T14:00:00+03:00',
        'end_datetime': '2026-04-17T15:00:00+03:00',
        'all_day': False,
        'description': '',
        'color': 'blue',
    }
    r = api_client.post('/api/calendar/events/', payload, format='json')
    assert r.status_code == 201, r.content
    # Server persists in UTC; confirm the DB value is 11:00 UTC
    obj = CalendarEvent.objects.get(pk=r.data['id'])
    assert obj.start_datetime.hour == 11
    assert obj.start_datetime.minute == 0


@pytest.mark.django_db
def test_end_before_start_rejected(api_client, user):
    api_client.force_authenticate(user=user)
    payload = {
        'title': 'Invalid',
        'event_type': 'event',
        'start_datetime': '2026-04-17T14:00:00+03:00',
        'end_datetime': '2026-04-17T13:00:00+03:00',
        'all_day': False,
        'description': '',
        'color': 'blue',
    }
    r = api_client.post('/api/calendar/events/', payload, format='json')
    assert r.status_code == 400
    assert 'end_datetime' in r.data


@pytest.mark.django_db
def test_end_equal_start_rejected(api_client, user):
    api_client.force_authenticate(user=user)
    payload = {
        'title': 'Invalid equal',
        'event_type': 'event',
        'start_datetime': '2026-04-17T14:00:00+03:00',
        'end_datetime': '2026-04-17T14:00:00+03:00',
        'all_day': False,
        'description': '',
        'color': 'blue',
    }
    r = api_client.post('/api/calendar/events/', payload, format='json')
    assert r.status_code == 400


@pytest.mark.django_db
def test_patch_partial_update_uses_existing_start(api_client, user):
    """PATCH that touches only end_datetime must still validate against the
    event's current start_datetime, not an empty one."""
    api_client.force_authenticate(user=user)
    create = api_client.post(
        '/api/calendar/events/',
        {
            'title': 'Seed',
            'event_type': 'event',
            'start_datetime': '2026-04-17T14:00:00+03:00',
            'end_datetime': '2026-04-17T15:00:00+03:00',
            'color': 'blue',
        },
        format='json',
    )
    assert create.status_code == 201
    event_id = create.data['id']

    # New end earlier than existing start → rejected
    bad = api_client.patch(
        f'/api/calendar/events/{event_id}/',
        {'end_datetime': '2026-04-17T13:00:00+03:00'},
        format='json',
    )
    assert bad.status_code == 400

    # New end after start → accepted
    good = api_client.patch(
        f'/api/calendar/events/{event_id}/',
        {'end_datetime': '2026-04-17T16:00:00+03:00'},
        format='json',
    )
    assert good.status_code == 200


@pytest.mark.django_db
def test_null_end_accepted(api_client, user):
    """end_datetime=null (reminders, busy without end) stays valid."""
    api_client.force_authenticate(user=user)
    r = api_client.post(
        '/api/calendar/events/',
        {
            'title': 'Reminder',
            'event_type': 'reminder',
            'start_datetime': '2026-04-17T10:00:00+03:00',
            'end_datetime': None,
            'color': 'orange',
        },
        format='json',
    )
    assert r.status_code == 201
