from django.db import models
from django.conf import settings
from apps.clients.models import Client
from apps.deals.models import Deal
from apps.workspaces.managers import WorkspaceManager


class Task(models.Model):
    class Priority(models.TextChoices):
        LOW = 'low', 'Низкий'
        MEDIUM = 'medium', 'Средний'
        HIGH = 'high', 'Высокий'
        URGENT = 'urgent', 'Срочный'

    class Status(models.TextChoices):
        TODO = 'todo', 'К выполнению'
        IN_PROGRESS = 'in_progress', 'В работе'
        DONE = 'done', 'Готово'

    objects = WorkspaceManager()

    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_tasks'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_tasks'
    )
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.TODO)
    deadline = models.DateTimeField(null=True, blank=True)
    linked_client = models.ForeignKey(
        Client, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks'
    )
    linked_deal = models.ForeignKey(
        Deal, on_delete=models.SET_NULL, null=True, blank=True, related_name='tasks'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    class Meta:
        verbose_name = 'Task'
        verbose_name_plural = 'Tasks'
        ordering = ['-created_at']
