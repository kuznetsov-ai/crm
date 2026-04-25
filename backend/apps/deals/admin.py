from django.contrib import admin
from .models import Deal, DealNote

class DealNoteInline(admin.TabularInline):
    model = DealNote
    extra = 0
    readonly_fields = ('created_at',)

@admin.register(Deal)
class DealAdmin(admin.ModelAdmin):
    list_display = ('title', 'client', 'status', 'value_usd', 'assigned_to')
    list_filter = ('status',)
    search_fields = ('title', 'client__name')
    raw_id_fields = ('client', 'assigned_to', 'created_by')
    inlines = [DealNoteInline]
