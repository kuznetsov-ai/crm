from django.db import models
from django.conf import settings
from apps.workspaces.managers import WorkspaceManager


class ChatChannel(models.Model):
    class ChannelType(models.TextChoices):
        DIRECT = 'direct', 'Личный'
        GROUP = 'group', 'Групповой'

    workspace = models.ForeignKey(
        'workspaces.Workspace', on_delete=models.CASCADE, related_name='+'
    )
    name = models.CharField(max_length=255, blank=True)
    channel_type = models.CharField(max_length=10, choices=ChannelType.choices, default=ChannelType.DIRECT)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='chat_channels')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkspaceManager()

    def __str__(self):
        return self.name or f'Direct #{self.pk}'

    @classmethod
    def get_or_create_direct(cls, user1, user2, workspace=None):
        """Get or create a direct channel between two users."""
        channels = cls.objects.filter(
            channel_type=cls.ChannelType.DIRECT, members=user1
        ).filter(members=user2)
        if channels.exists():
            return channels.first(), False
        channel = cls.objects.create(channel_type=cls.ChannelType.DIRECT, workspace=workspace)
        channel.members.add(user1, user2)
        return channel, True

    class Meta:
        verbose_name = 'Chat Channel'
        verbose_name_plural = 'Chat Channels'
        ordering = ['-updated_at']


class ChatMessage(models.Model):
    workspace = models.ForeignKey(
        'workspaces.Workspace', on_delete=models.CASCADE, related_name='+'
    )
    channel = models.ForeignKey(ChatChannel, on_delete=models.CASCADE, related_name='messages')
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='chat_messages'
    )
    text = models.TextField(blank=True)
    attachment = models.FileField(upload_to='chat/', null=True, blank=True)
    attachment_name = models.CharField(max_length=255, blank=True)
    attachment_size = models.PositiveBigIntegerField(default=0)
    attachment_mime = models.CharField(max_length=100, blank=True)
    reply_to = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='replies'
    )
    forwarded_from = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='forwards'
    )
    is_edited = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkspaceManager()

    def __str__(self):
        return f'Message #{self.pk} in {self.channel}'

    class Meta:
        verbose_name = 'Chat Message'
        verbose_name_plural = 'Chat Messages'
        ordering = ['created_at']


class ChatReaction(models.Model):
    workspace = models.ForeignKey(
        'workspaces.Workspace', on_delete=models.CASCADE, related_name='+'
    )
    message = models.ForeignKey(ChatMessage, on_delete=models.CASCADE, related_name='reactions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    emoji = models.CharField(max_length=10)

    objects = WorkspaceManager()

    class Meta:
        unique_together = ('message', 'user', 'emoji')
        verbose_name = 'Chat Reaction'


class ChatMention(models.Model):
    """Record of an `@someone` mention inside a chat message.

    Separate table (rather than a JSON field) so an in-app inbox of "where I was
    @-mentioned" is a cheap indexed query. Created by the message serializer
    whenever it detects `@<email-local-part>` or `@<first_name>` tokens.
    """
    workspace = models.ForeignKey(
        'workspaces.Workspace', on_delete=models.CASCADE, related_name='+'
    )
    message = models.ForeignKey(ChatMessage, on_delete=models.CASCADE, related_name='mentions')
    mentioned_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_mentions',
    )
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = WorkspaceManager()

    class Meta:
        unique_together = ('message', 'mentioned_user')
        indexes = [models.Index(fields=['mentioned_user', 'read'])]
        ordering = ['-created_at']

    def __str__(self):
        return f'@{self.mentioned_user} in msg {self.message_id}'


class ChatMessageRead(models.Model):
    """Read receipt: which user has read which message and when.

    Used for ✓✓ marker. Soft state — created on first observation.
    Indexed for "who read this message" and "what's my last-read in this channel" queries.
    """
    workspace = models.ForeignKey(
        'workspaces.Workspace', on_delete=models.CASCADE, related_name='+'
    )
    message = models.ForeignKey(ChatMessage, on_delete=models.CASCADE, related_name='reads')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='message_reads')
    read_at = models.DateTimeField(auto_now_add=True)

    objects = WorkspaceManager()

    class Meta:
        unique_together = ('message', 'user')
        indexes = [
            models.Index(fields=['user', 'message']),
            models.Index(fields=['message', 'read_at']),
        ]
        ordering = ['-read_at']
