"""Extended block-based global search for Studio CRM.

Mirrors the ITQ CRM pattern (banks) but for an outstaff domain. Each block is an
independent filter against the Client graph (deals, tasks, rate cards, notes);
a block is applied only when the payload enables it. Result is a paginated list
of clients with aggregated counts so a BDM can answer questions like:

  • Clients with active deals closing in 60 days AND at least 1 rate card with margin < 25%
  • Clients where the last transcript mentions "bench" AND tech_stack contains "Java"
  • Prospects in Retail in Italy with >2 open tasks assigned to me

The schema mirrors the ITQ payload: a dict of block_key → per-block filters. The
view returns a uniform `{ results, count, page, page_size, warnings }` envelope.
"""
from __future__ import annotations
from typing import Any
from datetime import datetime, timedelta
from django.db.models import Q, Count, Sum, Avg
from django.utils import timezone
from apps.clients.models import Client, ClientNote, RateCard
from apps.deals.models import Deal
from apps.tasks.models import Task


STATUS_CHOICES = {
    'client': ['lead', 'prospect', 'active', 'paused', 'churned'],
    'deal': ['new_lead', 'discovery', 'proposal', 'negotiation', 'signed', 'active', 'closed', 'lost'],
    'task': ['todo', 'in_progress', 'done'],
}

TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent']

RATE_ROLES = ['ba', 'sa', 'dev_junior', 'dev_middle', 'dev_senior', 'dev_lead',
              'qa', 'devops', 'pm', 'other']

NOTE_KINDS = ['note', 'meeting', 'call', 'transcript', 'decision']


def schema() -> dict:
    """Return the block schema so the UI can render tabs/tooltips dynamically."""
    return {
        'blocks': {
            'client': {
                'available': True,
                'fields': ['industry', 'country', 'company_size', 'budget_range',
                           'status', 'tech_stack_contains', 'has_contacts'],
            },
            'deals': {
                'available': True,
                'fields': ['status', 'value_op', 'assigned_to', 'close_range',
                           'ending_within_days'],
            },
            'tasks': {
                'available': True,
                'fields': ['priority', 'status', 'assigned_to', 'overdue'],
            },
            'rate_cards': {
                'available': True,
                'fields': ['role', 'unit', 'bill_rate_op', 'margin_pct_op'],
            },
            'notes': {
                'available': True,
                'fields': ['kind', 'body_contains', 'date_range', 'pinned_only'],
            },
        },
        'choices': {
            'client_status': STATUS_CHOICES['client'],
            'deal_status': STATUS_CHOICES['deal'],
            'task_status': STATUS_CHOICES['task'],
            'task_priority': TASK_PRIORITIES,
            'rate_role': RATE_ROLES,
            'note_kind': NOTE_KINDS,
        },
    }


def _parse_date(val: Any):
    if not val:
        return None
    if isinstance(val, datetime):
        return val.date()
    try:
        return datetime.fromisoformat(str(val)).date()
    except ValueError:
        return None


def _apply_op(qs, field: str, op: str, value):
    if value in (None, ''):
        return qs
    mapping = {'gte': f'{field}__gte', 'gt': f'{field}__gt',
               'lte': f'{field}__lte', 'lt': f'{field}__lt', 'eq': field}
    key = mapping.get(op)
    if not key:
        return qs
    return qs.filter(**{key: value})


def _deals_block_filter(deal_filter: dict) -> Q:
    """Translate deals block into Q acting on Client via `deals` relation."""
    q = Q()
    status = deal_filter.get('status')
    if status:
        q &= Q(deals__status=status)
    value_filter = deal_filter.get('value_op') or {}
    if value_filter.get('value') is not None:
        q &= _op_to_q('deals__value_usd', value_filter.get('op', 'gte'), value_filter['value'])
    assigned = deal_filter.get('assigned_to')
    if assigned:
        q &= Q(deals__assigned_to_id=assigned)
    close_range = deal_filter.get('close_range') or {}
    d_from = _parse_date(close_range.get('from'))
    d_to = _parse_date(close_range.get('to'))
    if d_from:
        q &= Q(deals__expected_close_date__gte=d_from)
    if d_to:
        q &= Q(deals__expected_close_date__lte=d_to)
    ending_within = deal_filter.get('ending_within_days')
    if ending_within:
        today = timezone.localdate()
        q &= Q(
            deals__status__in=['active', 'signed'],
            deals__end_date__gte=today,
            deals__end_date__lte=today + timedelta(days=int(ending_within)),
        )
    return q


def _op_to_q(field: str, op: str, value):
    """Return a Q for a given operator."""
    if op == 'gte':
        return Q(**{f'{field}__gte': value})
    if op == 'gt':
        return Q(**{f'{field}__gt': value})
    if op == 'lte':
        return Q(**{f'{field}__lte': value})
    if op == 'lt':
        return Q(**{f'{field}__lt': value})
    return Q(**{field: value})


def _tasks_block_filter(tf: dict) -> Q:
    q = Q()
    # Match Task through linked_client OR linked_deal.client
    if tf.get('priority'):
        q &= (Q(tasks_linked__priority=tf['priority']) | Q(deals__tasks__priority=tf['priority']))
    if tf.get('status'):
        q &= (Q(tasks_linked__status=tf['status']) | Q(deals__tasks__status=tf['status']))
    if tf.get('assigned_to'):
        q &= (Q(tasks_linked__assigned_to_id=tf['assigned_to']) | Q(deals__tasks__assigned_to_id=tf['assigned_to']))
    if tf.get('overdue'):
        now = timezone.now()
        q &= Q(tasks_linked__deadline__lt=now) & ~Q(tasks_linked__status='done')
    return q


def _rate_cards_block_filter(rf: dict) -> Q:
    q = Q()
    if rf.get('role'):
        q &= Q(rate_cards__role=rf['role'])
    if rf.get('unit'):
        q &= Q(rate_cards__unit=rf['unit'])
    br = rf.get('bill_rate_op') or {}
    if br.get('value') is not None:
        q &= _op_to_q('rate_cards__bill_rate_usd', br.get('op', 'gte'), br['value'])
    return q


def _notes_block_filter(nf: dict) -> Q:
    q = Q()
    if nf.get('kind'):
        q &= Q(notes__kind=nf['kind'])
    if nf.get('body_contains'):
        q &= Q(notes__body__icontains=nf['body_contains'])
    if nf.get('pinned_only'):
        q &= Q(notes__pinned=True)
    dr = nf.get('date_range') or {}
    d_from = _parse_date(dr.get('from'))
    d_to = _parse_date(dr.get('to'))
    if d_from:
        q &= Q(notes__created_at__gte=d_from)
    if d_to:
        q &= Q(notes__created_at__lte=d_to)
    return q


def _client_block_filter(cf: dict) -> Q:
    q = Q()
    if cf.get('industry'):
        q &= Q(industry__icontains=cf['industry'])
    if cf.get('country'):
        q &= Q(country__icontains=cf['country'])
    if cf.get('company_size'):
        q &= Q(company_size=cf['company_size'])
    if cf.get('budget_range'):
        q &= Q(budget_range=cf['budget_range'])
    if cf.get('status'):
        q &= Q(status=cf['status'])
    ts = cf.get('tech_stack_contains')
    if ts:
        # tech_stack is JSONField (list) — icontains on repr is a pragmatic fallback
        q &= Q(tech_stack__icontains=ts)
    if cf.get('has_contacts') == 'yes':
        q &= Q(contacts__isnull=False)
    if cf.get('has_contacts') == 'no':
        q &= Q(contacts__isnull=True)
    return q


def search(payload: dict, workspace=None) -> dict:
    """Execute the block-based search. See `schema()` for the expected payload shape."""
    blocks = payload.get('blocks') or {}
    page = max(1, int(payload.get('page') or 1))
    page_size = max(1, min(100, int(payload.get('page_size') or 20)))

    base_qs = Client.objects.all() if workspace is None else Client.objects.filter(workspace=workspace)
    qs = base_qs.select_related('assigned_to')
    warnings: list[dict] = []
    if not blocks:
        return {'results': [], 'count': 0, 'page': page, 'page_size': page_size, 'warnings': warnings}

    if 'client' in blocks:
        qs = qs.filter(_client_block_filter(blocks['client']))
    if 'deals' in blocks:
        qs = qs.filter(_deals_block_filter(blocks['deals']))
    if 'tasks' in blocks:
        qs = qs.filter(_tasks_block_filter(blocks['tasks']))
    if 'rate_cards' in blocks:
        qs = qs.filter(_rate_cards_block_filter(blocks['rate_cards']))
    if 'notes' in blocks:
        qs = qs.filter(_notes_block_filter(blocks['notes']))

    qs = qs.distinct()
    total = qs.count()

    # Aggregate counts on the page slice for nicer UX
    offset = (page - 1) * page_size
    page_qs = qs[offset:offset + page_size]
    results = []
    for c in page_qs:
        deal_agg = c.deals.aggregate(
            open=Count('id', filter=Q(status__in=['new_lead', 'discovery', 'proposal', 'negotiation'])),
            won=Count('id', filter=Q(status__in=['signed', 'active'])),
            total_value_won=Sum('value_usd', filter=Q(status__in=['signed', 'active'])),
        )
        rc_agg = c.rate_cards.filter(unit='monthly').aggregate(
            avg_bill=Avg('bill_rate_usd'),
            avg_cost=Avg('cost_rate_usd'),
            count=Count('id'),
        )
        results.append({
            'id': c.id,
            'name': c.name,
            'industry': c.industry,
            'country': c.country,
            'status': c.status,
            'company_size': c.company_size,
            'budget_range': c.budget_range,
            'assigned_to': c.assigned_to.full_name if c.assigned_to else None,
            'open_deals': deal_agg['open'] or 0,
            'won_deals': deal_agg['won'] or 0,
            'won_usd': float(deal_agg['total_value_won'] or 0),
            'rate_cards_count': rc_agg['count'] or 0,
            'avg_bill_usd': float(rc_agg['avg_bill'] or 0),
            'avg_cost_usd': float(rc_agg['avg_cost'] or 0),
            'notes_count': c.notes.count(),
        })

    return {
        'results': results,
        'count': total,
        'page': page,
        'page_size': page_size,
        'warnings': warnings,
    }
