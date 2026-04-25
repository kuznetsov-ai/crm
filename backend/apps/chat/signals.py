"""
Chat signals — auto-create DM channels.

When a new Membership is created, we ensure every pair of workspace
members has a DM ChatChannel.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='workspaces.Membership')
def create_dm_channels_on_membership(sender, instance, created, **kwargs):
    """On new Membership create DM channels with all *other* workspace members."""
    if not created:
        return

    from .models import ChatChannel
    from apps.workspaces.models import Membership

    workspace = instance.workspace
    new_user = instance.user

    # All other members in this workspace (excluding the new user)
    other_memberships = Membership.objects.filter(
        workspace=workspace
    ).exclude(user=new_user).select_related('user')

    for m in other_memberships:
        channel, _ = ChatChannel.get_or_create_direct(
            new_user, m.user, workspace=workspace
        )
        # Ensure workspace is set (get_or_create_direct sets it, but just in case)
        if channel.workspace_id is None:
            channel.workspace = workspace
            channel.save(update_fields=['workspace'])
