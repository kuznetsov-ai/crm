from django.db import models
from django.conf import settings


class Pipeline(models.Model):
    class Kind(models.TextChoices):
        LEAD = 'lead', 'Лид'
        DEAL = 'deal', 'Сделка'

    workspace = models.ForeignKey('workspaces.Workspace', on_delete=models.CASCADE, related_name='pipelines')
    kind = models.CharField(max_length=8, choices=Kind.choices)
    name = models.CharField(max_length=255)
    is_default = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('workspace', 'kind', 'name')]
        ordering = ['kind', 'order', 'name']
        constraints = [
            models.UniqueConstraint(
                fields=['workspace', 'kind'],
                condition=models.Q(is_default=True),
                name='unique_default_pipeline_per_workspace_kind',
            ),
        ]

    def __str__(self):
        return self.name


class Stage(models.Model):
    class Semantic(models.TextChoices):
        OPEN = 'open', 'Открыто'
        WON = 'won', 'Выиграно'
        LOST = 'lost', 'Проиграно'
        CONVERTED = 'converted', 'Конвертировано'

    pipeline = models.ForeignKey(Pipeline, on_delete=models.CASCADE, related_name='stages')
    name = models.CharField(max_length=255)
    code = models.SlugField(max_length=64)
    semantic = models.CharField(max_length=16, choices=Semantic.choices, default=Semantic.OPEN)
    color = models.CharField(max_length=16, default='#6B7280')
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = [('pipeline', 'code')]
        ordering = ['order']

    def __str__(self):
        return f'{self.pipeline.name} / {self.name}'


class StageChange(models.Model):
    class Entity(models.TextChoices):
        LEAD = 'lead', 'Lead'
        DEAL = 'deal', 'Deal'

    workspace = models.ForeignKey('workspaces.Workspace', on_delete=models.CASCADE)
    entity_type = models.CharField(max_length=8, choices=Entity.choices)
    entity_id = models.PositiveIntegerField()
    from_stage = models.ForeignKey(Stage, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    to_stage = models.ForeignKey(Stage, on_delete=models.PROTECT, related_name='+')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                             on_delete=models.SET_NULL)
    comment = models.TextField(blank=True)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['entity_type', 'entity_id', 'at'])]
        ordering = ['-at']
