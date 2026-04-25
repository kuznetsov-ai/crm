from django.db import models
from django.conf import settings
from apps.workspaces.managers import WorkspaceManager


class Favorite(models.Model):
    class EntityType(models.TextChoices):
        CLIENT = 'client', 'Client'
        DEAL = 'deal', 'Deal'
        TASK = 'task', 'Task'

    objects = WorkspaceManager()

    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
    )
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='favorites')
    entity_type = models.CharField(max_length=20, choices=EntityType.choices)
    entity_id = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'entity_type', 'entity_id')
        indexes = [models.Index(fields=['user', 'entity_type'])]
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user} ♥ {self.entity_type}#{self.entity_id}'
