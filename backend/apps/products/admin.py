from django.contrib import admin
from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'sku', 'workspace', 'unit', 'default_rate', 'default_rate_type', 'is_active']
    list_filter = ['workspace', 'is_active', 'default_rate_type']
    search_fields = ['name', 'sku']
