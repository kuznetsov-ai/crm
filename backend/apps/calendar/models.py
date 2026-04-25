from django.db import models
from django.conf import settings
from apps.workspaces.managers import WorkspaceManager


class CalendarEvent(models.Model):
    TYPE_CHOICES = [
        ('event', 'Event'),
        ('reminder', 'Reminder'),
        ('busy', 'Busy'),
    ]

    objects = WorkspaceManager()

    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
    )
    title = models.CharField(max_length=255)
    event_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default='event')
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField(null=True, blank=True)
    all_day = models.BooleanField(default=False)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=20, default='blue')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='calendar_events',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['start_datetime']

    def __str__(self):
        return f"{self.title} ({self.start_datetime.date()})"
