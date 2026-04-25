from django.db import models
from django.conf import settings
from apps.clients.models import Client
from apps.deals.models import Deal
from apps.workspaces.managers import WorkspaceManager


class Event(models.Model):
    class EventType(models.TextChoices):
        MEETING = 'meeting', 'Встреча'
        CALL = 'call', 'Звонок'
        OTHER = 'other', 'Другое'

    objects = WorkspaceManager()

    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    is_all_day = models.BooleanField(default=False)
    
    event_type = models.CharField(
        max_length=20, choices=EventType.choices, default=EventType.OTHER
    )

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='events'
    )
    
    # Links to other CRM entities
    linked_client = models.ForeignKey(
        Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='calendar_events'
    )
    linked_deal = models.ForeignKey(
        Deal, on_delete=models.SET_NULL, null=True, blank=True, related_name='calendar_events'
    )

    # External Sync (Google Calendar, Outlook, etc.)
    external_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.start_time.date()})"

    class Meta:
        ordering = ['start_time']
