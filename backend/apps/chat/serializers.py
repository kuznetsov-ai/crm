import re
from rest_framework import serializers
from .models import ChatChannel, ChatMessage, ChatReaction, ChatMention
from apps.users.models import User


MENTION_RE = re.compile(r'@([A-Za-z0-9_.\-]+)')


def extract_mentions(text: str, channel_members=None) -> list:
    """Find `@token` matches and resolve to User rows.

    Resolution rules (in order):
      1. exact email local-part match among channel_members
      2. first_name (case-insensitive) match among channel_members
      3. first_name match in full User table
    Returns a de-duplicated list of User instances.
    """
    if not text:
        return []
    tokens = [m.group(1).lower() for m in MENTION_RE.finditer(text)]
    if not tokens:
        return []
    resolved: dict[int, User] = {}
    members = list(channel_members) if channel_members is not None else []
    for tok in tokens:
        user = None
        for m in members:
            if m.email and m.email.split('@')[0].lower() == tok:
                user = m; break
            if (m.first_name or '').lower() == tok:
                user = m; break
        if not user:
            user = User.objects.filter(first_name__iexact=tok).first()
        if user and user.id not in resolved:
            resolved[user.id] = user
    return list(resolved.values())


class MentionUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name']


class ChatMentionSerializer(serializers.ModelSerializer):
    mentioned_user = MentionUserSerializer(read_only=True)
    class Meta:
        model = ChatMention
        fields = ['id', 'mentioned_user', 'read', 'created_at']


class ChatUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name', 'avatar']


class ChatReactionSerializer(serializers.ModelSerializer):
    user = ChatUserSerializer(read_only=True)
    class Meta:
        model = ChatReaction
        fields = ['id', 'emoji', 'user']


class ChatMessageSerializer(serializers.ModelSerializer):
    author = ChatUserSerializer(read_only=True)
    reactions = ChatReactionSerializer(many=True, read_only=True)
    reply_to_preview = serializers.SerializerMethodField()
    forwarded_from_preview = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()
    attachment = serializers.FileField(write_only=True, required=False, allow_null=True)
    mentions = serializers.SerializerMethodField()
    read_by = serializers.SerializerMethodField()

    class Meta:
        model = ChatMessage
        fields = ['id', 'channel', 'author', 'text', 'reply_to', 'reply_to_preview',
                  'forwarded_from', 'forwarded_from_preview',
                  'is_edited', 'reactions', 'created_at', 'updated_at',
                  'attachment', 'attachment_url', 'attachment_name',
                  'attachment_size', 'attachment_mime', 'mentions', 'read_by']
        read_only_fields = ['id', 'author', 'is_edited', 'created_at', 'updated_at',
                            'attachment_name', 'attachment_size', 'attachment_mime',
                            'attachment_url', 'mentions', 'read_by', 'forwarded_from_preview']

    def get_forwarded_from_preview(self, obj):
        if obj.forwarded_from:
            f = obj.forwarded_from
            return {
                'id': f.id,
                'text': (f.text or '')[:120],
                'author': f.author.full_name if f.author else '',
            }
        return None

    def get_read_by(self, obj):
        # List of user_ids that have read the message (excluding the author)
        try:
            return list(obj.reads.values_list('user_id', flat=True))
        except Exception:
            return []

    def get_mentions(self, obj):
        return [
            {'id': m.mentioned_user_id,
             'email': m.mentioned_user.email,
             'full_name': m.mentioned_user.full_name,
             'read': m.read}
            for m in obj.mentions.all().select_related('mentioned_user') if m.mentioned_user
        ]

    def get_reply_to_preview(self, obj):
        if obj.reply_to:
            return {'id': obj.reply_to.id, 'text': obj.reply_to.text[:100],
                    'author': obj.reply_to.author.full_name if obj.reply_to.author else ''}
        return None

    def get_attachment_url(self, obj):
        if not obj.attachment:
            return None
        # Return relative URL so it resolves via the same origin (frontend nginx proxy).
        # build_absolute_uri() loses the port when nginx forwards Host without it.
        return obj.attachment.url


class ChatChannelSerializer(serializers.ModelSerializer):
    members = ChatUserSerializer(many=True, read_only=True)
    member_ids = serializers.PrimaryKeyRelatedField(
        many=True, source='members', queryset=User.objects.all(), write_only=True,
        required=False,
    )
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = ChatChannel
        fields = ['id', 'name', 'display_name', 'channel_type', 'members', 'member_ids',
                  'last_message', 'unread_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_display_name(self, obj):
        """For DM channels: other user's name. For groups: channel.name."""
        if obj.channel_type == 'direct':
            request = self.context.get('request')
            current_user_id = request.user.id if request and request.user.is_authenticated else None
            other = next(
                (m for m in obj.members.all() if m.id != current_user_id),
                None,
            )
            if other:
                return other.full_name or other.email
        return obj.name or f'Group #{obj.pk}'

    def get_last_message(self, obj):
        # messages are prefetched; use last() on the cached queryset
        msgs = list(obj.messages.all())
        if msgs:
            msg = msgs[-1]
            return {
                'text': msg.text[:80],
                'author': msg.author.full_name if msg.author else '',
                'created_at': msg.created_at,
            }
        return None

    def get_unread_count(self, obj):
        return 0  # simplified — full read receipts in future
