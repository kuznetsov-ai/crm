from django.contrib import admin
from .models import ChatChannel, ChatMessage, ChatReaction

@admin.register(ChatChannel)
class ChatChannelAdmin(admin.ModelAdmin):
    list_display = ('__str__', 'channel_type', 'created_at')
    filter_horizontal = ('members',)

@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('pk', 'channel', 'author', 'text', 'created_at')
    raw_id_fields = ('channel', 'author', 'reply_to')
