from django.urls import path
from .views import (
    ChatChannelListView, ChatChannelDetailView, ChatMessageListView, DirectChannelView,
    MyMentionsView, MentionMarkReadView, ChatMessageDetailView, ChatMessageSearchView,
    ChatPresenceView, ChatMarkReadView, ChatMembersView, ChatMediaView,
    ChatMessageForwardView,
)

urlpatterns = [
    path('', ChatChannelListView.as_view(), name='chat-channel-list'),
    path('mentions/', MyMentionsView.as_view(), name='chat-mentions'),
    path('mentions/mark-read/', MentionMarkReadView.as_view(), name='chat-mentions-mark-read'),
    path('messages/<int:pk>/', ChatMessageDetailView.as_view(), name='chat-message-detail'),
    path('messages/<int:pk>/forward/', ChatMessageForwardView.as_view(), name='chat-message-forward'),
    path('<int:pk>/', ChatChannelDetailView.as_view(), name='chat-channel-detail'),
    path('<int:channel_id>/messages/', ChatMessageListView.as_view(), name='chat-message-list'),
    path('<int:channel_id>/search/', ChatMessageSearchView.as_view(), name='chat-message-search'),
    path('<int:channel_id>/presence/', ChatPresenceView.as_view(), name='chat-presence'),
    path('<int:channel_id>/mark-read/', ChatMarkReadView.as_view(), name='chat-mark-read'),
    path('<int:channel_id>/members/', ChatMembersView.as_view(), name='chat-members'),
    path('<int:channel_id>/members/<int:user_id>/', ChatMembersView.as_view(), name='chat-members-remove'),
    path('<int:channel_id>/media/', ChatMediaView.as_view(), name='chat-media'),
    path('direct/', DirectChannelView.as_view(), name='chat-direct'),
]
