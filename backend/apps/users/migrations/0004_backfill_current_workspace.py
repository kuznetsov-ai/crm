from django.db import migrations


def backfill(apps, schema_editor):
    User = apps.get_model('users', 'User')
    Workspace = apps.get_model('workspaces', 'Workspace')
    try:
        idev = Workspace.objects.get(slug='idev')
    except Workspace.DoesNotExist:
        return
    User.objects.filter(current_workspace__isnull=True).update(current_workspace=idev)


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_user_current_workspace'),
        ('workspaces', '0003_seed_default_idev'),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
