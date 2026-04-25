from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver


@receiver(pre_save, sender='leads.Lead')
def _remember_previous_stage(sender, instance, **kwargs):
    if not instance.pk:
        instance._prev_stage_id = None
        return
    try:
        prev = sender.objects.only('stage_id').get(pk=instance.pk)
        instance._prev_stage_id = prev.stage_id
    except sender.DoesNotExist:
        instance._prev_stage_id = None


@receiver(post_save, sender='leads.Lead')
def _auto_pipeline_stage_and_history(sender, instance, created, **kwargs):
    from apps.pipelines.models import Pipeline, Stage, StageChange

    # 1. Auto-attach default lead pipeline+stage if missing.
    updates = {}
    if instance.pipeline_id is None:
        p = Pipeline.objects.filter(
            workspace_id=instance.workspace_id, kind='lead', is_default=True
        ).first()
        if p:
            updates['pipeline_id'] = p.id
            instance.pipeline_id = p.id

    if instance.stage_id is None and instance.pipeline_id:
        s = Stage.objects.filter(
            pipeline_id=instance.pipeline_id, semantic='open'
        ).order_by('order').first()
        if s:
            updates['stage_id'] = s.id
            instance.stage_id = s.id

    if updates:
        sender.objects.filter(pk=instance.pk).update(**updates)

    # 2. Stage change history.
    prev = getattr(instance, '_prev_stage_id', None)
    if instance.stage_id and instance.stage_id != prev:
        StageChange.objects.create(
            workspace_id=instance.workspace_id,
            entity_type='lead',
            entity_id=instance.pk,
            from_stage_id=prev,
            to_stage_id=instance.stage_id,
        )
