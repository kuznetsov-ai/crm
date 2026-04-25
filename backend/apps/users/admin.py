from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Role, Employee, SalesPlan


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'full_name', 'role', 'is_active', 'is_staff')
    list_filter = ('role', 'is_active', 'is_staff', 'language')
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('email',)
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal', {'fields': ('first_name', 'last_name', 'avatar', 'language', 'role')}),
        ('Permissions', {'fields': ('is_active', 'is_staff', 'is_superuser')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )
    add_fieldsets = (
        (None, {'fields': ('email', 'password1', 'password2', 'first_name', 'last_name', 'role')}),
    )


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'preset', 'can_manage_users', 'can_manage_deals', 'can_view_reports')


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ('user', 'position', 'department', 'manager')
    raw_id_fields = ('user', 'manager')


@admin.register(SalesPlan)
class SalesPlanAdmin(admin.ModelAdmin):
    list_display = ('employee', 'scope', 'period_start', 'period_end', 'target_amount_usd')
