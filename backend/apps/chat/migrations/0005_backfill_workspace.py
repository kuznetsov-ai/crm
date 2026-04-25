from django.db import migrations

AFFECTED_MODELS = ['ChatChannel', 'ChatMessage', 'ChatReaction', 'ChatMention']


def backfill(apps, schema_editor):
    Workspace = apps.get_model('workspaces', 'Workspace')
    try:
        idev = Workspace.objects.get(slug='idev')
    except Workspace.DoesNotExist:
        return
    for name in AFFECTED_MODELS:
        Model = apps.get_model('chat', name)
        Model.objects.filter(workspace__isnull=True).update(workspace=idev)


def unfill(apps, schema_editor):
    for name in AFFECTED_MODELS:
        Model = apps.get_model('chat', name)
        Model.objects.update(workspace=None)


class Migration(migrations.Migration):
    dependencies = [
        ('chat', '0004_add_workspace'),
        ('workspaces', '0003_seed_default_idev'),
    ]
    operations = [migrations.RunPython(backfill, unfill)]
