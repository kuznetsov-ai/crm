from django.db import models
from django.conf import settings
from apps.workspaces.managers import WorkspaceManager


class BacklogItem(models.Model):
    class Status(models.TextChoices):
        IDEA = 'idea', 'Идея'
        IN_PROGRESS = 'in_progress', 'В работе'
        TESTING = 'testing', 'Тестирование'
        DONE = 'done', 'Готово'

    class Priority(models.TextChoices):
        LOW = 'low', 'Низкий'
        MEDIUM = 'medium', 'Средний'
        HIGH = 'high', 'Высокий'

    objects = WorkspaceManager()

    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
    )
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.IDEA)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='backlog_items')
    votes = models.PositiveIntegerField(default=0)
    order = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['status', 'order', '-votes']


class BacklogComment(models.Model):
    objects = WorkspaceManager()

    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
    )
    item = models.ForeignKey(BacklogItem, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='backlog_comments')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Comment on {self.item}'

    class Meta:
        ordering = ['created_at']
