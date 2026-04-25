from django.db import models
from apps.workspaces.managers import WorkspaceManager


class Entity(models.TextChoices):
    CLIENT = 'client', 'Client'
    DEAL = 'deal', 'Deal'
    LEAD = 'lead', 'Lead'


class FieldType(models.TextChoices):
    STRING = 'string', 'String'
    TEXT = 'text', 'Text'
    NUMBER = 'number', 'Number'
    DATE = 'date', 'Date'
    DATETIME = 'datetime', 'Datetime'
    BOOLEAN = 'boolean', 'Boolean'
    ENUM = 'enum', 'Enum'
    MULTI_ENUM = 'multi_enum', 'Multi Enum'
    URL = 'url', 'URL'
    EMAIL = 'email', 'Email'


class CustomFieldDef(models.Model):
    workspace = models.ForeignKey(
        'workspaces.Workspace', on_delete=models.CASCADE, related_name='custom_field_defs',
    )
    entity = models.CharField(max_length=20, choices=Entity.choices)
    code = models.SlugField(max_length=64)
    label = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=FieldType.choices, default=FieldType.STRING)
    # options: list of {code, label} dicts for enum/multi_enum types
    options = models.JSONField(default=list, blank=True)
    required = models.BooleanField(default=False)
    order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    help_text = models.CharField(max_length=500, blank=True)

    objects = WorkspaceManager()

    class Meta:
        unique_together = [('workspace', 'entity', 'code')]
        ordering = ['entity', 'order', 'label']

    def __str__(self):
        return f'{self.entity}.{self.code} ({self.label})'


class CustomFieldValue(models.Model):
    workspace = models.ForeignKey(
        'workspaces.Workspace', on_delete=models.CASCADE, related_name='+',
    )
    field = models.ForeignKey(
        'custom_fields.CustomFieldDef', on_delete=models.CASCADE, related_name='values',
    )
    entity = models.CharField(max_length=20, choices=Entity.choices)
    entity_id = models.PositiveIntegerField()

    value_text = models.TextField(blank=True, null=True)
    value_number = models.DecimalField(max_digits=20, decimal_places=6, null=True, blank=True)
    value_date = models.DateField(null=True, blank=True)
    value_datetime = models.DateTimeField(null=True, blank=True)
    value_bool = models.BooleanField(null=True, blank=True)
    value_json = models.JSONField(null=True, blank=True)

    class Meta:
        unique_together = [('field', 'entity', 'entity_id')]
        indexes = [
            models.Index(fields=['entity', 'entity_id']),
        ]

    def __str__(self):
        return f'CustomFieldValue(field={self.field_id}, entity={self.entity}, entity_id={self.entity_id})'
