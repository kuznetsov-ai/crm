from django.db import models
from django.conf import settings
from apps.workspaces.managers import WorkspaceManager


class WebhookEndpoint(models.Model):
    """Outbound webhook config. Each event fires a POST to `url` with a JSON payload.

    Standard integrations: n8n, Zapier, Make. Payload shape is intentionally flat
    and framework-agnostic so any receiver can consume it.
    """
    class Event(models.TextChoices):
        DEAL_CREATED = 'deal.created', 'Deal created'
        DEAL_UPDATED = 'deal.updated', 'Deal updated'
        DEAL_WON = 'deal.won', 'Deal won (signed/active)'
        DEAL_LOST = 'deal.lost', 'Deal lost'
        CLIENT_CREATED = 'client.created', 'Client created'
        TASK_CREATED = 'task.created', 'Task created'

    objects = WorkspaceManager()

    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
    )
    name = models.CharField(max_length=100)
    url = models.URLField(max_length=500)
    events = models.JSONField(default=list, help_text='List of event names this endpoint subscribes to')
    secret = models.CharField(max_length=120, blank=True, help_text='Optional shared secret, sent as X-Studio-Signature header')
    active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='webhooks')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} → {self.url}'


class WebhookDelivery(models.Model):
    """Audit log for each outbound fire, so failures are debuggable."""
    objects = WorkspaceManager()

    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
    )
    endpoint = models.ForeignKey(WebhookEndpoint, on_delete=models.CASCADE, related_name='deliveries')
    event = models.CharField(max_length=50)
    payload = models.JSONField()
    status_code = models.PositiveSmallIntegerField(default=0)
    response_snippet = models.CharField(max_length=500, blank=True)
    error = models.TextField(blank=True)
    duration_ms = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
