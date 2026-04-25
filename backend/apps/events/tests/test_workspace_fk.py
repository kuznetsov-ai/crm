import pytest
from datetime import datetime, timezone
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace
from apps.events.models import Event

User = get_user_model()


@pytest.mark.django_db
def test_event_workspace_fk_not_null():
    assert not Event._meta.get_field('workspace').null


@pytest.mark.django_db
def test_for_workspace_filters_events():
    ws_a = Workspace.objects.get(slug='idev')
    ws_b = Workspace.objects.create(slug='b', name='B')
    u = User.objects.create_user(email='ev@e', password='pw')
    Event.objects.create(
        title='a',
        start_time=datetime(2026, 4, 22, 10, 0, tzinfo=timezone.utc),
        end_time=datetime(2026, 4, 22, 11, 0, tzinfo=timezone.utc),
        assigned_to=u, workspace=ws_a,
    )
    Event.objects.create(
        title='b',
        start_time=datetime(2026, 4, 22, 10, 0, tzinfo=timezone.utc),
        end_time=datetime(2026, 4, 22, 11, 0, tzinfo=timezone.utc),
        assigned_to=u, workspace=ws_b,
    )
    assert list(Event.objects.for_workspace(ws_a).values_list('title', flat=True)) == ['a']
