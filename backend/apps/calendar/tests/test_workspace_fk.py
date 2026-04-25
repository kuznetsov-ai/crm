import pytest
from datetime import datetime, timezone
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace
from apps.calendar.models import CalendarEvent

User = get_user_model()


@pytest.mark.django_db
def test_calendar_event_workspace_fk_not_null():
    assert not CalendarEvent._meta.get_field('workspace').null


@pytest.mark.django_db
def test_for_workspace_filters_events():
    ws_a = Workspace.objects.get(slug='idev')
    ws_b = Workspace.objects.create(slug='b', name='B')
    u = User.objects.create_user(email='cal@e', password='pw')
    CalendarEvent.objects.create(
        title='a', start_datetime=datetime(2026, 4, 22, 10, 0, tzinfo=timezone.utc),
        created_by=u, workspace=ws_a,
    )
    CalendarEvent.objects.create(
        title='b', start_datetime=datetime(2026, 4, 22, 10, 0, tzinfo=timezone.utc),
        created_by=u, workspace=ws_b,
    )
    assert list(CalendarEvent.objects.for_workspace(ws_a).values_list('title', flat=True)) == ['a']
