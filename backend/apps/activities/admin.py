from django.contrib import admin
from .models import Activity


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ['id', 'type', 'entity', 'entity_id', 'author', 'subject', 'is_pinned', 'created_at']
    list_filter = ['type', 'entity', 'is_pinned', 'workspace']
    search_fields = ['subject', 'body', 'author__email']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
