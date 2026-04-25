from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from .models import ChatChannel, ChatMessage, ChatMention
from .serializers import (
    ChatChannelSerializer, ChatMessageSerializer, ChatMentionSerializer,
    extract_mentions,
)


class ChatChannelListView(WorkspaceScopedViewSetMixin, generics.ListCreateAPIView):
    queryset = ChatChannel.objects.all()
    serializer_class = ChatChannelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        ws = getattr(self.request, 'workspace', None)
        if ws is None:
            return ChatChannel.objects.none()
        qs = (
            ChatChannel.objects
            .filter(workspace=ws, members=self.request.user)
            .prefetch_related('members', 'messages')
            .order_by('-updated_at')
        )
        return qs

    def perform_create(self, serializer):
        ws = getattr(self.request, 'workspace', None) or getattr(self.request.user, 'current_workspace', None)
        channel = serializer.save(workspace=ws)
        # Creator is always added; member_ids are handled by the serializer
        channel.members.add(self.request.user)

    def create(self, request, *args, **kwargs):
        ws = getattr(request, 'workspace', None)
        # Validate member_ids belong to this workspace
        member_ids = request.data.get('member_ids', [])
        if member_ids and ws is not None:
            from apps.workspaces.models import Membership
            ws_user_ids = set(
                Membership.objects.filter(workspace=ws).values_list('user_id', flat=True)
            )
            bad = [mid for mid in member_ids if mid not in ws_user_ids]
            if bad:
                return Response(
                    {'member_ids': f'Users {bad} are not members of this workspace.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        return super().create(request, *args, **kwargs)


class ChatChannelDetailView(generics.RetrieveAPIView):
    serializer_class = ChatChannelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ChatChannel.objects.filter(members=self.request.user)


class ChatMessageListView(generics.ListCreateAPIView):
    serializer_class = ChatMessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        channel_id = self.kwargs['channel_id']
        # verify membership
        if not ChatChannel.objects.filter(pk=channel_id, members=self.request.user).exists():
            return ChatMessage.objects.none()
        return ChatMessage.objects.filter(channel_id=channel_id).select_related('author', 'reply_to__author').prefetch_related('reactions__user').order_by('created_at')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx

    def create(self, request, *args, **kwargs):
        channel_id = self.kwargs['channel_id']
        if not ChatChannel.objects.filter(pk=channel_id, members=request.user).exists():
            return Response({'error': 'Not a channel member'}, status=status.HTTP_403_FORBIDDEN)

        text = (request.data.get('text') or '').strip()
        file = request.FILES.get('attachment')
        reply_to_id = request.data.get('reply_to') or None

        if not text and not file:
            return Response({'error': 'Message must have text or attachment'}, status=status.HTTP_400_BAD_REQUEST)

        reply_to = None
        if reply_to_id:
            try:
                reply_to = ChatMessage.objects.get(pk=reply_to_id, channel_id=channel_id)
            except ChatMessage.DoesNotExist:
                reply_to = None

        workspace = getattr(request.user, 'current_workspace', None)
        msg = ChatMessage.objects.create(
            channel_id=channel_id,
            author=request.user,
            text=text,
            reply_to=reply_to,
            workspace=workspace,
            attachment=file if file else None,
            attachment_name=file.name if file else '',
            attachment_size=file.size if file else 0,
            attachment_mime=getattr(file, 'content_type', '') if file else '',
        )

        # Bump channel updated_at so it floats to top of list
        ChatChannel.objects.filter(pk=channel_id).update(updated_at=msg.created_at)

        # Create mention rows for anyone @-tagged
        channel_obj = ChatChannel.objects.prefetch_related('members').get(pk=channel_id)
        mentioned = extract_mentions(text, channel_members=channel_obj.members.all())
        for u in mentioned:
            ChatMention.objects.get_or_create(message=msg, mentioned_user=u, defaults={'workspace': workspace})

        data = ChatMessageSerializer(msg, context={'request': request}).data

        # Broadcast via Channels layer so connected websockets receive the new message
        layer = get_channel_layer()
        if layer is not None:
            ws_id = msg.workspace_id
            group_name = f'ws_{ws_id}_chat_{channel_id}' if ws_id else f'chat_{channel_id}'
            async_to_sync(layer.group_send)(
                group_name,
                {'type': 'chat_message', 'message': data},
            )

        return Response(data, status=status.HTTP_201_CREATED)


class ChatMessageDetailView(APIView):
    """PATCH/DELETE /api/chat/messages/<id>/ — edit own message text or delete it.

    Author-only. Broadcasts the change to all connected websockets in the channel.
    """
    permission_classes = [IsAuthenticated]

    def _msg(self, pk, request):
        try:
            msg = ChatMessage.objects.select_related('channel', 'workspace').get(pk=pk)
        except ChatMessage.DoesNotExist:
            return None, Response({'error': 'not_found'}, status=status.HTTP_404_NOT_FOUND)
        if msg.author_id != request.user.id:
            return None, Response({'error': 'not_author'}, status=status.HTTP_403_FORBIDDEN)
        return msg, None

    def patch(self, request, pk):
        msg, err = self._msg(pk, request)
        if err: return err
        text = (request.data.get('text') or '').strip()
        if not text:
            return Response({'error': 'empty_text'}, status=status.HTTP_400_BAD_REQUEST)
        msg.text = text
        msg.is_edited = True
        msg.save(update_fields=['text', 'is_edited', 'updated_at'])

        data = ChatMessageSerializer(msg, context={'request': request}).data
        layer = get_channel_layer()
        if layer is not None:
            ws_id = msg.workspace_id
            group_name = f'ws_{ws_id}_chat_{msg.channel_id}' if ws_id else f'chat_{msg.channel_id}'
            async_to_sync(layer.group_send)(group_name, {'type': 'chat_message_edited', 'message': data})
        return Response(data)

    def delete(self, request, pk):
        msg, err = self._msg(pk, request)
        if err: return err
        channel_id = msg.channel_id
        ws_id = msg.workspace_id
        msg_id = msg.id
        msg.delete()
        layer = get_channel_layer()
        if layer is not None:
            group_name = f'ws_{ws_id}_chat_{channel_id}' if ws_id else f'chat_{channel_id}'
            async_to_sync(layer.group_send)(group_name, {'type': 'chat_message_deleted', 'message_id': msg_id})
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChatMessageSearchView(APIView):
    """GET /api/chat/<channel_id>/search/?q=... — full-text-ish search through a channel."""
    permission_classes = [IsAuthenticated]

    def get(self, request, channel_id):
        if not ChatChannel.objects.filter(pk=channel_id, members=request.user).exists():
            return Response({'error': 'not_a_member'}, status=status.HTTP_403_FORBIDDEN)
        q = (request.query_params.get('q') or '').strip()
        if not q:
            return Response({'results': [], 'q': ''})
        msgs = (
            ChatMessage.objects
            .filter(channel_id=channel_id, text__icontains=q)
            .select_related('author', 'reply_to__author')
            .prefetch_related('reactions__user')
            .order_by('-created_at')[:50]
        )
        data = ChatMessageSerializer(msgs, many=True, context={'request': request}).data
        return Response({'results': data, 'q': q, 'count': len(data)})


class MyMentionsView(generics.ListAPIView):
    """GET /api/chat/mentions/ — mentions of the current user (latest first)."""
    serializer_class = ChatMentionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        unread = self.request.query_params.get('unread')
        qs = ChatMention.objects.filter(mentioned_user=self.request.user).select_related('message', 'message__author')
        if unread in ('1', 'true'):
            qs = qs.filter(read=False)
        return qs[:50]


class MentionMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ids = request.data.get('ids') or []
        updated = ChatMention.objects.filter(
            mentioned_user=request.user, id__in=ids, read=False,
        ).update(read=True)
        return Response({'updated': updated})


class DirectChannelView(APIView):
    """POST /api/chat/direct/ — get or create a direct channel with another user."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.users.models import User
        user_id = request.data.get('user_id')
        try:
            other_user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)
        workspace = getattr(request, 'workspace', None) or getattr(request.user, 'current_workspace', None)

        # Validate that target user is in the same workspace
        if workspace is not None:
            from apps.workspaces.models import Membership
            if not Membership.objects.filter(workspace=workspace, user=other_user).exists():
                return Response({'error': 'User is not a member of this workspace'}, status=400)

        channel, created = ChatChannel.get_or_create_direct(request.user, other_user, workspace=workspace)
        return Response(
            ChatChannelSerializer(channel, context={'request': request}).data,
            status=201 if created else 200,
        )
