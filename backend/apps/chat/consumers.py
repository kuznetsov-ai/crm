import json
from urllib.parse import parse_qs
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import sync_to_async
from django.utils import timezone


@sync_to_async
def _resolve_ws(user, slug):
    from apps.workspaces.models import Workspace, Membership
    if slug:
        return Workspace.objects.filter(
            slug=slug, is_active=True, memberships__user=user
        ).first()
    cur = getattr(user, 'current_workspace', None)
    if cur and Membership.objects.filter(workspace=cur, user=user).exists():
        return cur
    return None


class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.channel_id = self.scope['url_route']['kwargs']['channel_id']
        self.user = self.scope['user']

        if not self.user or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        # Resolve workspace from ?ws= query param or user.current_workspace
        qs = parse_qs((self.scope.get('query_string') or b'').decode())
        slug = (qs.get('ws') or [None])[0]

        ws = await _resolve_ws(self.user, slug)
        if ws is None:
            await self.close(code=4403)
            return
        self.workspace = ws

        self.room_group_name = f'ws_{ws.id}_chat_{self.channel_id}'

        # Verify user is a member of the chat channel
        is_member = await self.check_membership()
        if not is_member:
            await self.close()
            return

        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get('type', 'message')

        if msg_type == 'message':
            text = data.get('text', '').strip()
            reply_to_id = data.get('reply_to')
            if not text:
                return
            message = await self.save_message(text, reply_to_id)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                }
            )

        elif msg_type == 'reaction':
            msg_id = data.get('message_id')
            emoji = data.get('emoji', '').strip()
            if msg_id and emoji:
                result = await self.toggle_reaction(msg_id, emoji)
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {'type': 'chat_reaction', 'result': result}
                )

        elif msg_type == 'typing':
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_typing',
                    'user_id': self.user.id,
                    'user_name': getattr(self.user, 'full_name', None) or self.user.email,
                    'is_typing': bool(data.get('is_typing')),
                    'sender_channel_name': self.channel_name,
                }
            )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({'type': 'message', 'message': event['message']}))

    async def chat_reaction(self, event):
        await self.send(text_data=json.dumps({'type': 'reaction', 'result': event['result']}))

    async def chat_typing(self, event):
        # Don't echo back to the sender
        if event.get('sender_channel_name') == self.channel_name:
            return
        await self.send(text_data=json.dumps({
            'type': 'typing',
            'user_id': event['user_id'],
            'user_name': event['user_name'],
            'is_typing': event['is_typing'],
        }))

    @database_sync_to_async
    def check_membership(self):
        from apps.chat.models import ChatChannel
        return ChatChannel.objects.filter(pk=self.channel_id, members=self.user).exists()

    @database_sync_to_async
    def save_message(self, text, reply_to_id=None):
        from apps.chat.models import ChatMessage, ChatChannel, ChatMention
        from apps.chat.serializers import ChatMessageSerializer, extract_mentions
        channel = ChatChannel.objects.prefetch_related('members').get(pk=self.channel_id)
        reply_to = None
        if reply_to_id:
            try:
                reply_to = ChatMessage.objects.get(pk=reply_to_id, channel=channel)
            except ChatMessage.DoesNotExist:
                pass
        msg = ChatMessage.objects.create(
            channel=channel, author=self.user, text=text, reply_to=reply_to,
            workspace=self.workspace,
        )
        for u in extract_mentions(text, channel_members=channel.members.all()):
            ChatMention.objects.get_or_create(message=msg, mentioned_user=u,
                                              defaults={'workspace': self.workspace})
        return ChatMessageSerializer(msg).data

    @database_sync_to_async
    def toggle_reaction(self, message_id, emoji):
        from apps.chat.models import ChatMessage, ChatReaction
        try:
            msg = ChatMessage.objects.get(pk=message_id, channel_id=self.channel_id)
        except ChatMessage.DoesNotExist:
            return None
        reaction, created = ChatReaction.objects.get_or_create(
            message=msg, user=self.user, emoji=emoji,
            defaults={'workspace': self.workspace},
        )
        if not created:
            reaction.delete()
            action = 'removed'
        else:
            action = 'added'
        return {'message_id': message_id, 'emoji': emoji, 'action': action,
                'user_id': self.user.id}
