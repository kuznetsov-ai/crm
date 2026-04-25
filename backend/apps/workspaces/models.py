from django.conf import settings as dj_settings
from django.db import models


class CurrencyRate(models.Model):
    base = models.CharField(max_length=3)    # e.g. 'USD'
    quote = models.CharField(max_length=3)   # e.g. 'RUB'
    rate = models.DecimalField(max_digits=14, decimal_places=6)
    source = models.CharField(max_length=64)  # e.g. 'cbr-xml-daily.ru'
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fetched_at']
        indexes = [models.Index(fields=['base', 'quote', '-fetched_at'], name='currency_rate_base_quote_idx')]

    def __str__(self):
        return f'{self.base}/{self.quote} = {self.rate} @ {self.fetched_at}'


class Workspace(models.Model):
    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    subdomain = models.CharField(max_length=64, unique=True, null=True, blank=True)
    settings = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Membership(models.Model):
    class Role(models.TextChoices):
        OWNER = 'owner', 'Owner'
        ADMIN = 'admin', 'Admin'
        MEMBER = 'member', 'Member'
        GUEST = 'guest', 'Guest'

    workspace = models.ForeignKey(
        Workspace, on_delete=models.CASCADE, related_name='memberships'
    )
    user = models.ForeignKey(
        dj_settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='memberships'
    )
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('workspace', 'user')]
        ordering = ['-joined_at']

    def __str__(self):
        return f'{self.user} @ {self.workspace} ({self.role})'
