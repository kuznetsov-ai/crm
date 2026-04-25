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
        return ChatMessage.objects.filter(channel_id=channel_id).select_related('author', 'reply_to__author', 'forwarded_from__author').prefetch_related('reactions__user', 'reads').order_by('created_at')

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


class ChatPresenceView(APIView):
    """GET /api/chat/<channel_id>/presence/ — last_seen for every member."""
    permission_classes = [IsAuthenticated]

    def get(self, request, channel_id):
        if not ChatChannel.objects.filter(pk=channel_id, members=request.user).exists():
            return Response({'error': 'not_a_member'}, status=status.HTTP_403_FORBIDDEN)
        from django.contrib.auth import get_user_model
        from django.utils import timezone
        from datetime import timedelta
        User = get_user_model()
        members = (
            User.objects.filter(chat_channels__id=channel_id)
            .values('id', 'first_name', 'last_name', 'email', 'last_seen')
        )
        now = timezone.now()
        result = []
        for m in members:
            ls = m['last_seen']
            online = bool(ls and (now - ls) < timedelta(seconds=60))
            result.append({
                'user_id': m['id'],
                'name': f"{m['first_name']} {m['last_name']}".strip() or m['email'],
                'last_seen': ls.isoformat() if ls else None,
                'online': online,
            })
        return Response({'members': result, 'now': now.isoformat()})


class ChatMarkReadView(APIView):
    """POST /api/chat/<channel_id>/mark-read/ {message_ids: [...]} — record read receipts."""
    permission_classes = [IsAuthenticated]

    def post(self, request, channel_id):
        if not ChatChannel.objects.filter(pk=channel_id, members=request.user).exists():
            return Response({'error': 'not_a_member'}, status=status.HTTP_403_FORBIDDEN)
        ids = request.data.get('message_ids') or []
        if not isinstance(ids, list):
            return Response({'error': 'message_ids must be list'}, status=status.HTTP_400_BAD_REQUEST)
        from .models import ChatMessageRead
        msgs = ChatMessage.objects.filter(pk__in=ids, channel_id=channel_id).exclude(author=request.user)
        ws_id = getattr(request, 'workspace', None)
        ws_id = ws_id.id if ws_id else (msgs.first().workspace_id if msgs.exists() else None)
        created_ids = []
        for m in msgs:
            _, created = ChatMessageRead.objects.get_or_create(
                message=m, user=request.user,
                defaults={'workspace_id': m.workspace_id},
            )
            if created:
                created_ids.append(m.id)

        # Broadcast each new read receipt over WS
        layer = get_channel_layer()
        if layer is not None and created_ids:
            from django.utils import timezone
            now_iso = timezone.now().isoformat()
            for mid in created_ids:
                async_to_sync(layer.group_send)(
                    f'ws_{ws_id}_chat_{channel_id}' if ws_id else f'chat_{channel_id}',
                    {
                        'type': 'chat_message_read',
                        'message_id': mid,
                        'user_id': request.user.id,
                        'read_at': now_iso,
                    }
                )
        return Response({'ok': True, 'marked': len(created_ids)})


class ChatMembersView(APIView):
    """POST /api/chat/<channel_id>/members/ {user_ids: [...]} — add to group.
    DELETE /api/chat/<channel_id>/members/<user_id>/ — remove from group.
    """
    permission_classes = [IsAuthenticated]

    def _channel(self, channel_id, request):
        try:
            ch = ChatChannel.objects.get(pk=channel_id, members=request.user)
        except ChatChannel.DoesNotExist:
            return None, Response({'error': 'not_a_member'}, status=status.HTTP_403_FORBIDDEN)
        if ch.channel_type != ChatChannel.ChannelType.GROUP:
            return None, Response({'error': 'not_a_group'}, status=status.HTTP_400_BAD_REQUEST)
        return ch, None

    def post(self, request, channel_id):
        ch, err = self._channel(channel_id, request)
        if err: return err
        ids = request.data.get('user_ids') or []
        if not isinstance(ids, list) or not ids:
            return Response({'error': 'user_ids required'}, status=status.HTTP_400_BAD_REQUEST)
        from django.contrib.auth import get_user_model
        User = get_user_model()
        users = User.objects.filter(pk__in=ids)
        for u in users:
            ch.members.add(u)
        return Response({'ok': True, 'added': [u.id for u in users]})

    def delete(self, request, channel_id, user_id=None):
        ch, err = self._channel(channel_id, request)
        if err: return err
        if user_id is None:
            return Response({'error': 'user_id required'}, status=status.HTTP_400_BAD_REQUEST)
        ch.members.remove(user_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ChatMediaView(APIView):
    """GET /api/chat/<channel_id>/media/?kind=image|audio|file — gallery view."""
    permission_classes = [IsAuthenticated]

    def get(self, request, channel_id):
        if not ChatChannel.objects.filter(pk=channel_id, members=request.user).exists():
            return Response({'error': 'not_a_member'}, status=status.HTTP_403_FORBIDDEN)
        kind = request.query_params.get('kind') or 'all'
        qs = (
            ChatMessage.objects.filter(channel_id=channel_id)
            .exclude(attachment='')
            .exclude(attachment__isnull=True)
            .select_related('author')
            .order_by('-created_at')
        )
        if kind == 'image':
            qs = qs.filter(attachment_mime__startswith='image/')
        elif kind == 'audio':
            qs = qs.filter(attachment_mime__startswith='audio/')
        elif kind == 'file':
            qs = qs.exclude(attachment_mime__startswith='image/').exclude(attachment_mime__startswith='audio/')
        qs = qs[:200]
        data = ChatMessageSerializer(qs, many=True, context={'request': request}).data
        return Response({'results': data, 'kind': kind, 'count': len(data)})


class ChatMessageForwardView(APIView):
    """POST /api/chat/messages/<id>/forward/ {channel_id} — repost into another channel."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            src = ChatMessage.objects.select_related('author', 'workspace').get(pk=pk)
        except ChatMessage.DoesNotExist:
            return Response({'error': 'not_found'}, status=status.HTTP_404_NOT_FOUND)

        target_id = request.data.get('channel_id')
        if not target_id:
            return Response({'error': 'channel_id required'}, status=status.HTTP_400_BAD_REQUEST)

        target = ChatChannel.objects.filter(pk=target_id, members=request.user).first()
        if not target:
            return Response({'error': 'not_a_member_of_target'}, status=status.HTTP_403_FORBIDDEN)

        msg = ChatMessage.objects.create(
            channel=target,
            author=request.user,
            text=src.text,
            workspace=target.workspace,
            forwarded_from=src,
            attachment=src.attachment if src.attachment else None,
            attachment_name=src.attachment_name,
            attachment_size=src.attachment_size,
            attachment_mime=src.attachment_mime,
        )
        ChatChannel.objects.filter(pk=target.id).update(updated_at=msg.created_at)

        data = ChatMessageSerializer(msg, context={'request': request}).data
        layer = get_channel_layer()
        if layer is not None:
            ws_id = msg.workspace_id
            group_name = f'ws_{ws_id}_chat_{target.id}' if ws_id else f'chat_{target.id}'
            async_to_sync(layer.group_send)(group_name, {'type': 'chat_message', 'message': data})
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
