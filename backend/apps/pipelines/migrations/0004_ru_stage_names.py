from django.db import migrations


RU_NAMES = {
    ('new_lead',    'New Lead'):    'Новый лид',
    ('discovery',   'Discovery'):   'Квалификация',
    ('proposal',    'Proposal'):    'Предложение',
    ('negotiation', 'Negotiation'): 'Переговоры',
    ('signed',      'Signed'):      'Подписано',
    ('active',      'Active'):      'В работе',
    ('closed',      'Closed'):      'Закрыто',
    ('lost',        'Lost'):        'Проиграно',
}


def rename_forward(apps, schema_editor):
    Stage = apps.get_model('pipelines', 'Stage')
    for (code, old_name), new_name in RU_NAMES.items():
        Stage.objects.filter(code=code, name=old_name).update(name=new_name)


def rename_backward(apps, schema_editor):
    Stage = apps.get_model('pipelines', 'Stage')
    for (code, old_name), new_name in RU_NAMES.items():
        Stage.objects.filter(code=code, name=new_name).update(name=old_name)


class Migration(migrations.Migration):
    dependencies = [
        ('pipelines', '0003_enforce_single_default'),
    ]
    operations = [migrations.RunPython(rename_forward, rename_backward)]
