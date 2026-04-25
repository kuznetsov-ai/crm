from django.db import migrations


def backfill(apps, schema_editor):
    Deal = apps.get_model('deals', 'Deal')
    Pipeline = apps.get_model('pipelines', 'Pipeline')
    Stage = apps.get_model('pipelines', 'Stage')

    pipelines_by_ws = {
        p.workspace_id: p for p in Pipeline.objects.filter(kind='deal', name='Default sales')
    }
    stages_by_pipeline_code = {
        (s.pipeline_id, s.code): s for s in Stage.objects.filter(pipeline__name='Default sales')
    }

    to_update = []
    for d in Deal.objects.all().iterator():
        p = pipelines_by_ws.get(d.workspace_id)
        if not p:
            continue
        s = stages_by_pipeline_code.get((p.id, d.status)) or stages_by_pipeline_code.get((p.id, 'new_lead'))
        d.pipeline_id = p.id
        d.stage_id = s.id if s else None
        to_update.append(d)

    if to_update:
        Deal.objects.bulk_update(to_update, ['pipeline', 'stage'], batch_size=500)


def unfill(apps, schema_editor):
    Deal = apps.get_model('deals', 'Deal')
    Deal.objects.update(pipeline=None, stage=None)


class Migration(migrations.Migration):
    dependencies = [
        ('deals', '0006_add_stage_fk'),
        ('pipelines', '0002_seed_default_pipeline'),
    ]
    operations = [migrations.RunPython(backfill, unfill)]
