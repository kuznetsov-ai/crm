from django.contrib import admin
from .models import BacklogItem, BacklogComment

class CommentInline(admin.TabularInline):
    model = BacklogComment
    extra = 0

@admin.register(BacklogItem)
class BacklogItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'status', 'votes', 'author')
    list_filter = ('status',)
    inlines = [CommentInline]
