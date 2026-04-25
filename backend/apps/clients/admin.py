from django.contrib import admin
from .models import Client, Contact

class ContactInline(admin.TabularInline):
    model = Contact
    extra = 0
    fields = ('first_name', 'last_name', 'email', 'position', 'is_primary')

@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ('name', 'industry', 'status', 'assigned_to', 'created_at')
    list_filter = ('status', 'industry', 'company_size')
    search_fields = ('name', 'industry')
    raw_id_fields = ('assigned_to', 'created_by')
    inlines = [ContactInline]

@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'email', 'position', 'client', 'is_primary')
    search_fields = ('first_name', 'last_name', 'email')
    raw_id_fields = ('client',)
