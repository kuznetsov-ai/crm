from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.deals.models import Deal
from apps.clients.models import Client
from apps.tasks.models import Task
from .dispatcher import dispatch


def _deal_payload(deal: Deal) -> dict:
    return {
        'id': deal.id,
        'title': deal.title,
        'status': deal.status,
        'value_usd': float(deal.value_usd),
        'probability': deal.probability,
        'client_id': deal.client_id,
        'client_name': deal.client.name if deal.client_id else None,
        'assigned_to_id': deal.assigned_to_id,
        'expected_close_date': deal.expected_close_date.isoformat() if deal.expected_close_date else None,
    }


@receiver(post_save, sender=Deal)
def on_deal_save(sender, instance: Deal, created: bool, **kwargs):
    payload = _deal_payload(instance)
    if created:
        dispatch('deal.created', payload)
    else:
        dispatch('deal.updated', payload)
        if instance.status in ('signed', 'active'):
            dispatch('deal.won', payload)
        elif instance.status == 'lost':
            dispatch('deal.lost', payload)


@receiver(post_save, sender=Client)
def on_client_save(sender, instance: Client, created: bool, **kwargs):
    if created:
        dispatch('client.created', {
            'id': instance.id,
            'name': instance.name,
            'industry': instance.industry,
            'country': instance.country,
            'status': instance.status,
        })


@receiver(post_save, sender=Task)
def on_task_save(sender, instance: Task, created: bool, **kwargs):
    if created:
        dispatch('task.created', {
            'id': instance.id,
            'title': instance.title,
            'priority': instance.priority,
            'status': instance.status,
            'assigned_to_id': instance.assigned_to_id,
            'linked_client_id': getattr(instance, 'linked_client_id', None),
            'linked_deal_id': getattr(instance, 'linked_deal_id', None),
        })
