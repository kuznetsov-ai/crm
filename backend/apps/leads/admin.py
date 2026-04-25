from django.contrib import admin
from .models import Lead


@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = ['title', 'company_name', 'pipeline', 'stage', 'assignee', 'workspace', 'created_at']
    list_filter = ['pipeline', 'stage', 'workspace']
    search_fields = ['title', 'company_name', 'email', 'phone']
    raw_id_fields = ['pipeline', 'stage', 'source', 'lost_reason', 'assignee',
                     'converted_client', 'converted_deal', 'workspace']
