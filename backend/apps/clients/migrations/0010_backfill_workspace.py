from django.db import migrations

AFFECTED_MODELS = ['Client', 'Contact', 'ClientDocument', 'ClientNote', 'RateCard', 'BenchPerson']


def backfill(apps, schema_editor):
    Workspace = apps.get_model('workspaces', 'Workspace')
    try:
        idev = Workspace.objects.get(slug='idev')
    except Workspace.DoesNotExist:
        return
    for name in AFFECTED_MODELS:
        Model = apps.get_model('clients', name)
        Model.objects.filter(workspace__isnull=True).update(workspace=idev)


def unfill(apps, schema_editor):
    for name in AFFECTED_MODELS:
        Model = apps.get_model('clients', name)
        Model.objects.update(workspace=None)


class Migration(migrations.Migration):
    dependencies = [
        ('clients', '0009_add_workspace'),
        ('workspaces', '0003_seed_default_idev'),
    ]
    operations = [migrations.RunPython(backfill, unfill)]
