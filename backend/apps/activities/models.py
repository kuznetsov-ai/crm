from django.db import models
from django.conf import settings
from apps.workspaces.managers import WorkspaceManager


class Activity(models.Model):
    class Type(models.TextChoices):
        NOTE = 'note', 'Note'
        CALL = 'call', 'Call'
        EMAIL = 'email', 'Email'
        MEETING = 'meeting', 'Meeting'
        TASK = 'task', 'Task'
        STAGE_CHANGE = 'stage_change', 'Stage Change'
        FIELD_CHANGE = 'field_change', 'Field Change'
        CREATED = 'created', 'Created'
        AI = 'ai', 'AI'

    class Entity(models.TextChoices):
        LEAD = 'lead', 'Lead'
        DEAL = 'deal', 'Deal'
        CLIENT = 'client', 'Client'

    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='activities',
    )
    type = models.CharField(max_length=20, choices=Type.choices)
    entity = models.CharField(max_length=10, choices=Entity.choices)
    entity_id = models.PositiveIntegerField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='activities',
    )
    subject = models.CharField(max_length=255, blank=True)
    body = models.TextField(blank=True)
    meta = models.JSONField(default=dict)
    due_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    is_pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkspaceManager()

    class Meta:
        verbose_name = 'Activity'
        verbose_name_plural = 'Activities'
        ordering = ['-is_pinned', '-created_at']
        indexes = [
            models.Index(fields=['entity', 'entity_id', '-created_at'],
                         name='act_entity_created_idx'),
            models.Index(fields=['workspace', 'type', 'due_at'],
                         name='act_ws_type_due_idx'),
        ]

    def __str__(self):
        return f'{self.type} on {self.entity}/{self.entity_id}'
