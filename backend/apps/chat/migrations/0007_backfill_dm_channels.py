"""Backfill DM channels for every existing pair of workspace members.

Idempotent: uses get_or_create_direct so running twice is safe.
"""
from django.db import migrations
from itertools import combinations


def backfill_dm_channels(apps, schema_editor):
    Workspace = apps.get_model('workspaces', 'Workspace')
    Membership = apps.get_model('workspaces', 'Membership')
    ChatChannel = apps.get_model('chat', 'ChatChannel')

    for ws in Workspace.objects.filter(is_active=True):
        members = list(
            Membership.objects.filter(workspace=ws).values_list('user_id', flat=True)
        )
        for u1_id, u2_id in combinations(members, 2):
            # Check by the same logic as get_or_create_direct
            exists = (
                ChatChannel.objects.filter(
                    channel_type='direct',
                    members=u1_id,
                ).filter(members=u2_id).exists()
            )
            if not exists:
                ch = ChatChannel.objects.create(
                    channel_type='direct',
                    name='',
                    workspace=ws,
                )
                ch.members.set([u1_id, u2_id])


class Migration(migrations.Migration):
    dependencies = [
        ('chat', '0006_workspace_not_null'),
        ('workspaces', '0003_seed_default_idev'),
    ]

    operations = [
        migrations.RunPython(backfill_dm_channels, migrations.RunPython.noop),
    ]
