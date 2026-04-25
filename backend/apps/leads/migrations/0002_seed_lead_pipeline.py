from django.db import migrations


STAGES = [
    ('new',         'Новый',          'open',      '#94A3B8', 0),
    ('in_progress', 'В работе',       'open',      '#3B82F6', 1),
    ('qualified',   'Квалифицирован', 'open',      '#10B981', 2),
    ('converted',   'Конвертирован',  'converted', '#047857', 3),
    ('rejected',    'Отказ',          'lost',      '#DC2626', 4),
]


def seed(apps, schema_editor):
    Workspace = apps.get_model('workspaces', 'Workspace')
    Pipeline = apps.get_model('pipelines', 'Pipeline')
    Stage = apps.get_model('pipelines', 'Stage')
    for ws in Workspace.objects.all():
        p, _ = Pipeline.objects.get_or_create(
            workspace=ws, kind='lead', name='Входящие',
            defaults={'is_default': True, 'order': 0},
        )
        for code, name, semantic, color, order in STAGES:
            Stage.objects.get_or_create(
                pipeline=p, code=code,
                defaults={'name': name, 'semantic': semantic, 'color': color, 'order': order},
            )


def unseed(apps, schema_editor):
    Pipeline = apps.get_model('pipelines', 'Pipeline')
    Pipeline.objects.filter(kind='lead', name='Входящие').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('leads', '0001_initial'),
        ('pipelines', '0002_seed_default_pipeline'),
    ]
    operations = [migrations.RunPython(seed, unseed)]
