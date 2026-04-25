"""Profitability roll-up per client.

Assumes team_size_needed from the deal × average blended margin from the client's rate cards.
This is a reasonable first-cut estimate while real time-tracking is not yet wired up.
"""
from decimal import Decimal
from django.db.models import Sum, Avg, Q
from apps.clients.models import Client, RateCard
from apps.deals.models import Deal


def client_profitability(workspace=None, top: int = 50) -> list[dict]:
    """Return per-client profitability rows ordered by estimated profit desc."""
    rows: list[dict] = []
    client_qs = Client.objects.filter(workspace=workspace) if workspace is not None else Client.objects.all()
    for client in client_qs:
        deals = Deal.objects.filter(client=client)
        pipeline_usd = deals.filter(
            status__in=['new_lead', 'discovery', 'proposal', 'negotiation']
        ).aggregate(s=Sum('value_usd'))['s'] or Decimal(0)
        won_usd = deals.filter(
            status__in=['signed', 'active']
        ).aggregate(s=Sum('value_usd'))['s'] or Decimal(0)
        lost_usd = deals.filter(status='lost').aggregate(s=Sum('value_usd'))['s'] or Decimal(0)

        # Average margin from rate cards (monthly preferred)
        cards = RateCard.objects.filter(client=client, unit='monthly')
        avg_bill = cards.aggregate(a=Avg('bill_rate_usd'))['a'] or Decimal(0)
        avg_cost = cards.aggregate(a=Avg('cost_rate_usd'))['a'] or Decimal(0)
        margin_pct = 0.0
        if avg_bill and avg_bill > 0:
            margin_pct = round(float(avg_bill - avg_cost) / float(avg_bill) * 100, 1)

        est_profit_usd = float(won_usd) * (margin_pct / 100) if margin_pct else 0.0

        rows.append({
            'client_id': client.id,
            'client_name': client.name,
            'industry': client.industry,
            'status': client.status,
            'pipeline_usd': float(pipeline_usd),
            'won_usd': float(won_usd),
            'lost_usd': float(lost_usd),
            'avg_bill_rate_usd': float(avg_bill),
            'avg_cost_rate_usd': float(avg_cost),
            'margin_pct': margin_pct,
            'est_profit_usd': round(est_profit_usd, 2),
            'rate_cards_count': cards.count(),
        })

    rows.sort(key=lambda r: r['est_profit_usd'], reverse=True)
    return rows[:top]
