from django.db import migrations


SOURCES = [
    ('ads',       'Реклама',          0),
    ('referral',  'Рекомендация',     1),
    ('cold_call', 'Холодный звонок',  2),
    ('partner',   'Партнёр',          3),
    ('website',   'Сайт',             4),
]

LOST_REASONS = [
    ('no_budget',    'Не бюджет',           0),
    ('competitor',   'Выбрали конкурента',  1),
    ('not_relevant', 'Не актуально',        2),
    ('no_contact',   'Нет связи',           3),
    ('other',        'Другое',              4),
]


def seed(apps, schema_editor):
    Workspace = apps.get_model('workspaces', 'Workspace')
    Source = apps.get_model('dictionaries', 'Source')
    LostReason = apps.get_model('dictionaries', 'LostReason')
    for ws in Workspace.objects.all():
        for code, name, order in SOURCES:
            Source.objects.get_or_create(
                workspace=ws, code=code,
                defaults={'name': name, 'order': order},
            )
        for code, name, order in LOST_REASONS:
            LostReason.objects.get_or_create(
                workspace=ws, code=code,
                defaults={'name': name, 'order': order},
            )


def unseed(apps, schema_editor):
    Source = apps.get_model('dictionaries', 'Source')
    LostReason = apps.get_model('dictionaries', 'LostReason')
    Source.objects.all().delete()
    LostReason.objects.all().delete()


class Migration(migrations.Migration):
    dependencies = [
        ('dictionaries', '0001_initial'),
        ('workspaces', '0003_seed_default_idev'),
    ]
    operations = [migrations.RunPython(seed, unseed)]
