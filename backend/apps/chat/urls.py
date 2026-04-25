from django.urls import path
from .views import (
    ChatChannelListView, ChatChannelDetailView, ChatMessageListView, DirectChannelView,
    MyMentionsView, MentionMarkReadView,
)

urlpatterns = [
    path('', ChatChannelListView.as_view(), name='chat-channel-list'),
    path('mentions/', MyMentionsView.as_view(), name='chat-mentions'),
    path('mentions/mark-read/', MentionMarkReadView.as_view(), name='chat-mentions-mark-read'),
    path('<int:pk>/', ChatChannelDetailView.as_view(), name='chat-channel-detail'),
    path('<int:channel_id>/messages/', ChatMessageListView.as_view(), name='chat-message-list'),
    path('direct/', DirectChannelView.as_view(), name='chat-direct'),
]
