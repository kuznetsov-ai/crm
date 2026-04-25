from django.db import migrations


def backfill(apps, schema_editor):
    Workspace = apps.get_model('workspaces', 'Workspace')
    try:
        idev = Workspace.objects.get(slug='idev')
    except Workspace.DoesNotExist:
        return
    Task = apps.get_model('tasks', 'Task')
    Task.objects.filter(workspace__isnull=True).update(workspace=idev)


def unfill(apps, schema_editor):
    Task = apps.get_model('tasks', 'Task')
    Task.objects.update(workspace=None)


class Migration(migrations.Migration):
    dependencies = [
        ('tasks', '0002_add_workspace'),
        ('workspaces', '0003_seed_default_idev'),
    ]
    operations = [migrations.RunPython(backfill, unfill)]
