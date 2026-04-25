from django.urls import path
from .views import (
    ChatChannelListView, ChatChannelDetailView, ChatMessageListView, DirectChannelView,
    MyMentionsView, MentionMarkReadView, ChatMessageDetailView, ChatMessageSearchView,
)

urlpatterns = [
    path('', ChatChannelListView.as_view(), name='chat-channel-list'),
    path('mentions/', MyMentionsView.as_view(), name='chat-mentions'),
    path('mentions/mark-read/', MentionMarkReadView.as_view(), name='chat-mentions-mark-read'),
    path('messages/<int:pk>/', ChatMessageDetailView.as_view(), name='chat-message-detail'),
    path('<int:pk>/', ChatChannelDetailView.as_view(), name='chat-channel-detail'),
    path('<int:channel_id>/messages/', ChatMessageListView.as_view(), name='chat-message-list'),
    path('<int:channel_id>/search/', ChatMessageSearchView.as_view(), name='chat-message-search'),
    path('direct/', DirectChannelView.as_view(), name='chat-direct'),
]
