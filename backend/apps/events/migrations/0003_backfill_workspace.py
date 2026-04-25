from django.db import migrations


def backfill(apps, schema_editor):
    Workspace = apps.get_model('workspaces', 'Workspace')
    try:
        idev = Workspace.objects.get(slug='idev')
    except Workspace.DoesNotExist:
        return
    Event = apps.get_model('events', 'Event')
    Event.objects.filter(workspace__isnull=True).update(workspace=idev)


def unfill(apps, schema_editor):
    Event = apps.get_model('events', 'Event')
    Event.objects.update(workspace=None)


class Migration(migrations.Migration):
    dependencies = [
        ('events', '0002_add_workspace'),
        ('workspaces', '0003_seed_default_idev'),
    ]
    operations = [migrations.RunPython(backfill, unfill)]
