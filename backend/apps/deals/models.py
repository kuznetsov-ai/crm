from decimal import Decimal
from django.db import models
from django.conf import settings
from apps.clients.models import Client
from apps.workspaces.managers import WorkspaceManager


class Deal(models.Model):
    class Status(models.TextChoices):
        NEW_LEAD = 'new_lead', 'Новый лид'
        DISCOVERY = 'discovery', 'Квалификация'
        PROPOSAL = 'proposal', 'Предложение'
        NEGOTIATION = 'negotiation', 'Переговоры'
        SIGNED = 'signed', 'Подписано'
        ACTIVE = 'active', 'В работе'
        CLOSED = 'closed', 'Закрыто'
        LOST = 'lost', 'Проиграно'

    title = models.CharField(max_length=255)
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='deals')
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='assigned_deals')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='created_deals')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NEW_LEAD)
    pipeline = models.ForeignKey(
        'pipelines.Pipeline', null=True, blank=True, on_delete=models.SET_NULL, related_name='deals'
    )
    stage = models.ForeignKey(
        'pipelines.Stage', null=True, blank=True, on_delete=models.SET_NULL, related_name='deals'
    )
    value_usd = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    amount_override = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True,
                                          help_text='When set, overrides the auto-sum of DealItem subtotals.')
    probability = models.PositiveSmallIntegerField(default=50)
    team_size_needed = models.PositiveSmallIntegerField(default=1)
    tech_requirements = models.JSONField(default=list, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    expected_close_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    source = models.ForeignKey(
        'dictionaries.Source', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
    )
    lost_reason = models.ForeignKey(
        'dictionaries.LostReason', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
    )
    lost_comment = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0, db_index=True)
    workspace = models.ForeignKey('workspaces.Workspace', on_delete=models.CASCADE, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkspaceManager()

    def __str__(self):
        return self.title

    @property
    def amount(self) -> Decimal:
        """Effective deal amount: override if set, else sum of item subtotals (= value_usd)."""
        if self.amount_override is not None:
            return self.amount_override
        return self.value_usd

    class Meta:
        verbose_name = 'Deal'
        verbose_name_plural = 'Deals'
        ordering = ['status', 'order', '-created_at']


class DealNote(models.Model):
    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, related_name='notes')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                null=True, related_name='deal_notes')
    text = models.TextField()
    is_deleted = models.BooleanField(default=False)
    workspace = models.ForeignKey('workspaces.Workspace', on_delete=models.CASCADE, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkspaceManager()

    def __str__(self):
        return f'Note on {self.deal}'

    class Meta:
        ordering = ['-created_at']


class DealDocument(models.Model):
    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, related_name='documents')
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to='deals/documents/')
    size = models.PositiveBigIntegerField(default=0)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, related_name='deal_documents')
    workspace = models.ForeignKey('workspaces.Workspace', on_delete=models.CASCADE, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    objects = WorkspaceManager()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.deal})'


class DealItem(models.Model):
    """A line-item inside a deal (role / rate / quantity) that contributes to deal.value_usd.

    The optional `product` FK links to a Product catalog entry. When set, the UI
    can snap `rate` and `rate_type` from Product.default_rate / Product.default_rate_type.
    The `role` field remains the free-text display label regardless.
    """

    class RateType(models.TextChoices):
        MONTHLY = 'monthly', 'Monthly'
        HOURLY = 'hourly', 'Hourly'
        FIXED = 'fixed', 'Fixed'

    deal = models.ForeignKey(Deal, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(
        'products.Product',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='deal_items',
    )
    role = models.CharField(max_length=255)
    ratecard_role = models.ForeignKey(
        'clients.RateCard', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='deal_items',
    )
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    rate_type = models.CharField(max_length=10, choices=RateType.choices, default=RateType.MONTHLY)
    quantity = models.PositiveIntegerField(default=1)
    months = models.PositiveIntegerField(default=1)
    hours = models.PositiveIntegerField(default=0)
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, editable=False, default=0)
    note = models.TextField(blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order', 'id']

    def _compute_subtotal(self) -> Decimal:
        rate = self.rate or Decimal('0')
        qty = self.quantity or 1
        if self.rate_type == self.RateType.MONTHLY:
            months = self.months or 1
            return rate * qty * months
        elif self.rate_type == self.RateType.HOURLY:
            hours = self.hours or 0
            return rate * qty * hours
        else:  # FIXED
            return rate * qty

    def save(self, *args, **kwargs):
        self.subtotal = self._compute_subtotal()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.role} @ {self.deal}'
