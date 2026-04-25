from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='pipelines.StageChange')
def _stage_change_to_activity(sender, instance, created, **kwargs):
    if not created:
        return
    from .models import Activity
    Activity.objects.create(
        workspace_id=instance.workspace_id,
        type=Activity.Type.STAGE_CHANGE,
        entity=instance.entity_type,
        entity_id=instance.entity_id,
        author_id=instance.user_id,
        meta={
            'from_stage_id': instance.from_stage_id,
            'to_stage_id': instance.to_stage_id,
            'from_name': instance.from_stage.name if instance.from_stage_id else None,
            'to_name': instance.to_stage.name if instance.to_stage_id else None,
            'from_code': instance.from_stage.code if instance.from_stage_id else None,
            'to_code': instance.to_stage.code if instance.to_stage_id else None,
        },
    )
