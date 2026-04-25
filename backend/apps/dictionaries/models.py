from django.db import models
from apps.workspaces.managers import WorkspaceManager


class _BaseDict(models.Model):
    workspace = models.ForeignKey('workspaces.Workspace', on_delete=models.CASCADE)
    code = models.SlugField(max_length=64)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)

    objects = WorkspaceManager()

    class Meta:
        abstract = True
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


class Source(_BaseDict):
    class Meta(_BaseDict.Meta):
        unique_together = [('workspace', 'code')]


class LostReason(_BaseDict):
    class Meta(_BaseDict.Meta):
        unique_together = [('workspace', 'code')]
