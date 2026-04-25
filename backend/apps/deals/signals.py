"""Signals for auto-recomputing Deal.value_usd from DealItem subtotals."""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.models import Sum


def _recompute_deal_value(deal):
    """Recompute deal.value_usd = sum of item subtotals (only when amount_override is None)."""
    if deal.amount_override is not None:
        return
    from django.db.models import Sum
    total = deal.items.aggregate(s=Sum('subtotal'))['s'] or 0
    deal.value_usd = total
    deal.save(update_fields=['value_usd'])


@receiver(post_save, sender='deals.DealItem')
def dealitem_post_save(sender, instance, **kwargs):
    _recompute_deal_value(instance.deal)


@receiver(post_delete, sender='deals.DealItem')
def dealitem_post_delete(sender, instance, **kwargs):
    _recompute_deal_value(instance.deal)
