from django.db import migrations


STAGES = [
    ('new_lead',    'Новый лид',    'open', '#94A3B8', 0),
    ('discovery',   'Квалификация', 'open', '#3B82F6', 1),
    ('proposal',    'Предложение',  'open', '#8B5CF6', 2),
    ('negotiation', 'Переговоры',   'open', '#F59E0B', 3),
    ('signed',      'Подписано',    'won',  '#10B981', 4),
    ('active',      'В работе',     'won',  '#059669', 5),
    ('closed',      'Закрыто',      'won',  '#047857', 6),
    ('lost',        'Проиграно',    'lost', '#DC2626', 7),
]


def seed(apps, schema_editor):
    Workspace = apps.get_model('workspaces', 'Workspace')
    Pipeline = apps.get_model('pipelines', 'Pipeline')
    Stage = apps.get_model('pipelines', 'Stage')
    for ws in Workspace.objects.all():
        p, _ = Pipeline.objects.get_or_create(
            workspace=ws, kind='deal', name='Default sales',
            defaults={'is_default': True, 'order': 0},
        )
        for code, name, semantic, color, order in STAGES:
            Stage.objects.get_or_create(
                pipeline=p, code=code,
                defaults={'name': name, 'semantic': semantic,
                          'color': color, 'order': order},
            )


def unseed(apps, schema_editor):
    Pipeline = apps.get_model('pipelines', 'Pipeline')
    Pipeline.objects.filter(name='Default sales').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('pipelines', '0001_initial'),
        ('workspaces', '0003_seed_default_idev'),
    ]
    operations = [migrations.RunPython(seed, unseed)]
