from django.db import models
from django.conf import settings
from apps.workspaces.managers import WorkspaceManager


class Lead(models.Model):
    title = models.CharField(max_length=255)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    company_name = models.CharField(max_length=255, blank=True)
    tax_id = models.CharField(max_length=20, blank=True)
    website = models.URLField(blank=True)

    pipeline = models.ForeignKey(
        'pipelines.Pipeline', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='leads',
    )
    stage = models.ForeignKey(
        'pipelines.Stage', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='leads',
    )
    source = models.ForeignKey(
        'dictionaries.Source', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
    )
    lost_reason = models.ForeignKey(
        'dictionaries.LostReason', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
    )
    lost_comment = models.TextField(blank=True)

    opportunity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='USD', blank=True)

    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='assigned_leads',
    )

    # Conversion references
    converted_client = models.ForeignKey(
        'clients.Client', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
    )
    converted_deal = models.ForeignKey(
        'deals.Deal', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
    )
    converted_at = models.DateTimeField(null=True, blank=True)

    workspace = models.ForeignKey(
        'workspaces.Workspace', on_delete=models.CASCADE, related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkspaceManager()

    def __str__(self):
        return self.title

    class Meta:
        verbose_name = 'Lead'
        verbose_name_plural = 'Leads'
        ordering = ['-created_at']
