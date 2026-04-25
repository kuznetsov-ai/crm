from django.contrib import admin
from .models import KPITarget


@admin.register(KPITarget)
class KPITargetAdmin(admin.ModelAdmin):
    list_display = ['assigned_to', 'metric', 'period', 'year', 'period_number', 'target_value', 'created_at']
    list_filter = ['metric', 'period', 'year']
    search_fields = ['assigned_to__email', 'assigned_to__first_name', 'assigned_to__last_name']
    ordering = ['-year', '-period_number', 'metric']
