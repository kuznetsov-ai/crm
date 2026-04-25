from django.db import models
from apps.workspaces.managers import WorkspaceManager


class Product(models.Model):
    """Product catalog entry — represents a service/product offered by the workspace.

    DealItem can optionally link to a Product (FK, null=True) so that rate/rate_type
    can be snapped from Product.default_rate / Product.default_rate_type at creation time.
    The DealItem.role field continues to serve as the free-text display label.
    """

    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='products',
    )
    name = models.CharField(max_length=255)
    sku = models.SlugField(max_length=64, blank=True)
    unit = models.CharField(
        max_length=32,
        blank=True,
        help_text='Unit of measurement (шт, мес, час, etc.)',
    )
    default_rate = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    default_rate_type = models.CharField(
        max_length=8,
        blank=True,
        help_text="'monthly', 'hourly', or 'fixed'",
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = WorkspaceManager()

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['workspace', 'sku'],
                condition=models.Q(sku__gt=''),
                name='unique_product_sku_per_workspace',
            ),
        ]

    def __str__(self):
        return self.name
