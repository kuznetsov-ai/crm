import csv
from io import StringIO

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from datetime import timedelta
from apps.clients.models import Client
from apps.deals.models import Deal
from apps.tasks.models import Task
from apps.workspaces.permissions import IsWorkspaceMember
from .profitability import client_profitability
from .global_search import schema as search_schema, search as run_search


class GlobalSearchSchemaView(APIView):
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get(self, request):
        return Response(search_schema())


class GlobalSearchView(APIView):
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def post(self, request):
        return Response(run_search(request.data or {}, workspace=request.workspace))


class ProfitabilityView(APIView):
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get(self, request):
        top = int(request.query_params.get('top', 50))
        rows = client_profitability(workspace=request.workspace, top=top)
        total_won = sum(r['won_usd'] for r in rows)
        total_profit = sum(r['est_profit_usd'] for r in rows)
        return Response({
            'rows': rows,
            'totals': {
                'clients': len(rows),
                'won_usd': total_won,
                'est_profit_usd': round(total_profit, 2),
            },
        })


def _user_cell(user):
    if not user:
        return '', ''
    name = user.full_name if hasattr(user, 'full_name') else f'{user.first_name} {user.last_name}'.strip()
    return user.email or '', name or user.email or ''


def _json_list(val):
    if val is None:
        return ''
    if isinstance(val, (list, tuple)):
        return '; '.join(str(x) for x in val)
    return str(val)


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get(self, request):
        ws = request.workspace
        now = timezone.now()
        thirty_days_ago = now - timedelta(days=30)

        # Period filter
        period = request.query_params.get('period', 'all')
        if period == 'month':
            start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif period == 'quarter':
            quarter_start_month = ((now.month - 1) // 3) * 3 + 1
            start = now.replace(month=quarter_start_month, day=1, hour=0, minute=0, second=0, microsecond=0)
        elif period == 'year':
            start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            start = None  # all time

        def deal_qs(extra_filter=None):
            qs = Deal.objects.filter(workspace=ws)
            if start:
                qs = qs.filter(created_at__gte=start)
            if extra_filter:
                qs = qs.filter(**extra_filter)
            return qs

        # Clients (clients are not period-filtered — base metric)
        total_clients = Client.objects.filter(workspace=ws).count()
        active_clients = Client.objects.filter(workspace=ws, status='active').count()
        new_clients_30d = Client.objects.filter(workspace=ws, created_at__gte=thirty_days_ago).count()

        # Deals
        total_deals = deal_qs().count()
        active_deals = deal_qs({'status__in': ['signed', 'active']}).count()
        deals_value = sum(
            d.value_usd for d in deal_qs({'status__in': ['signed', 'active']})
        ) or 0

        # Conversion rate: won (signed+active) / non-new-lead deals
        non_new_count = deal_qs({'status__in': ['discovery', 'proposal', 'negotiation', 'signed', 'active', 'closed', 'lost']}).count()
        won_count = deal_qs({'status__in': ['signed', 'active']}).count()
        conversion_rate = round((won_count / non_new_count * 100), 1) if non_new_count > 0 else 0.0

        # Pipeline funnel — labels come from Deal.Status so they stay localised in one place
        status_labels = dict(Deal.Status.choices)
        funnel = []
        for status_val in ['new_lead', 'discovery', 'proposal', 'negotiation', 'signed', 'active']:
            funnel.append({
                'status': status_val,
                'label': str(status_labels.get(status_val, status_val)),
                'count': deal_qs({'status': status_val}).count(),
            })

        # Tasks (always current user, not period-filtered)
        my_tasks_today = Task.objects.filter(
            workspace=ws, assigned_to=request.user, status__in=['todo', 'in_progress']
        ).count()
        overdue_tasks = Task.objects.filter(
            workspace=ws, deadline__lt=now, status__in=['todo', 'in_progress']
        ).count()

        return Response({
            'clients': {
                'total': total_clients,
                'active': active_clients,
                'new_30d': new_clients_30d,
            },
            'deals': {
                'total': total_deals,
                'active': active_deals,
                'pipeline_value_usd': float(deals_value),
                'conversion_rate': conversion_rate,
            },
            'funnel': funnel,
            'tasks': {
                'my_open': my_tasks_today,
                'overdue': overdue_tasks,
            },
        })


class ReportsView(APIView):
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get(self, request):
        from django.db.models import Count, Sum
        from django.db.models.functions import TruncMonth

        ws = request.workspace
        entity = request.query_params.get('entity', 'deals')  # deals|clients|tasks
        group_by = request.query_params.get('group_by', 'status')  # status|month|manager
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        filters = {'workspace': ws}
        if date_from:
            filters['created_at__date__gte'] = date_from
        if date_to:
            filters['created_at__date__lte'] = date_to

        if entity == 'deals':
            qs = Deal.objects.filter(**filters)
            if group_by == 'status':
                data = list(qs.values('status').annotate(count=Count('id'), total_value=Sum('value_usd')).order_by('-count'))
            elif group_by == 'month':
                data = list(qs.annotate(month=TruncMonth('created_at')).values('month').annotate(count=Count('id'), total_value=Sum('value_usd')).order_by('month'))
                data = [{'label': d['month'].strftime('%Y-%m') if d['month'] else '', 'count': d['count'], 'total_value': float(d['total_value'] or 0)} for d in data]
            elif group_by == 'manager':
                data = list(qs.values('assigned_to__first_name', 'assigned_to__last_name', 'assigned_to__email').annotate(count=Count('id'), total_value=Sum('value_usd')).order_by('-count'))
            else:
                data = []
        elif entity == 'clients':
            qs = Client.objects.filter(**filters)  # workspace already in filters
            if group_by == 'status':
                data = list(qs.values('status').annotate(count=Count('id')).order_by('-count'))
            elif group_by == 'month':
                data = list(qs.annotate(month=TruncMonth('created_at')).values('month').annotate(count=Count('id')).order_by('month'))
                data = [{'label': d['month'].strftime('%Y-%m') if d['month'] else '', 'count': d['count']} for d in data]
            elif group_by == 'industry':
                data = list(qs.values('industry').annotate(count=Count('id')).order_by('-count'))
            else:
                data = []
        elif entity == 'tasks':
            qs = Task.objects.filter(**filters)  # workspace already in filters
            if group_by == 'status':
                data = list(qs.values('status').annotate(count=Count('id')).order_by('-count'))
            elif group_by == 'priority':
                data = list(qs.values('priority').annotate(count=Count('id')).order_by('-count'))
            elif group_by == 'month':
                data = list(qs.annotate(month=TruncMonth('created_at')).values('month').annotate(count=Count('id')).order_by('month'))
                data = [{'label': d['month'].strftime('%Y-%m') if d['month'] else '', 'count': d['count']} for d in data]
            else:
                data = []
        else:
            data = []

        return Response({'entity': entity, 'group_by': group_by, 'data': data, 'total': len(data)})


class ReportsExportView(APIView):
    """Full-row CSV export for clients, deals, or tasks (maximum fields for spreadsheets)."""
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get(self, request):
        ws = request.workspace
        entity = request.query_params.get('entity', 'deals')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        filters = {'workspace': ws}
        if date_from:
            filters['created_at__date__gte'] = date_from
        if date_to:
            filters['created_at__date__lte'] = date_to

        buffer = StringIO()
        writer = csv.writer(buffer)

        if entity == 'clients':
            qs = (
                Client.objects.filter(**filters)
                .select_related('assigned_to', 'created_by')
                .prefetch_related('contacts')
                .annotate(documents_count=Count('documents', distinct=True))
            )
            writer.writerow([
                'id', 'name', 'industry', 'website', 'country', 'company_size', 'status',
                'tech_stack', 'budget_range', 'description',
                'assigned_to_email', 'assigned_to_name',
                'created_by_email', 'created_by_name',
                'contacts_count', 'contacts_detail', 'documents_count',
                'created_at', 'updated_at',
            ])
            for c in qs:
                ae, an = _user_cell(c.assigned_to)
                ce, cn = _user_cell(c.created_by)
                contact_chunks = []
                for ct in c.contacts.all():
                    contact_chunks.append(
                        ' | '.join(
                            p for p in [
                                ct.full_name,
                                f'email:{ct.email}' if ct.email else '',
                                f'phone:{ct.phone}' if ct.phone else '',
                                f'position:{ct.position}' if ct.position else '',
                                f'role:{ct.role}' if ct.role else '',
                                'primary' if ct.is_primary else '',
                                f'tg:{ct.telegram}' if ct.telegram else '',
                                f'wa:{ct.whatsapp}' if ct.whatsapp else '',
                                f'linkedin:{ct.linkedin}' if ct.linkedin else '',
                                f'lang:{ct.language_pref}' if ct.language_pref else '',
                                f'notes:{ct.notes}' if ct.notes else '',
                            ] if p
                        )
                    )
                contacts_detail = ' || '.join(contact_chunks)
                writer.writerow([
                    c.id, c.name, c.industry, c.website or '', c.country or '', c.company_size or '',
                    c.status, _json_list(c.tech_stack), c.budget_range or '', c.description or '',
                    ae, an, ce, cn,
                    len(contact_chunks), contacts_detail, c.documents_count,
                    c.created_at.isoformat() if c.created_at else '',
                    c.updated_at.isoformat() if c.updated_at else '',
                ])

        elif entity == 'deals':
            qs = (
                Deal.objects.filter(**filters)
                .select_related('client', 'assigned_to', 'created_by')
                .annotate(notes_live=Count('notes', filter=Q(notes__is_deleted=False)))
            )
            writer.writerow([
                'id', 'title', 'client_id', 'client_name', 'client_status',
                'status', 'value_usd', 'probability', 'team_size_needed',
                'tech_requirements', 'start_date', 'end_date', 'expected_close_date',
                'description', 'order',
                'assigned_to_email', 'assigned_to_name',
                'created_by_email', 'created_by_name',
                'notes_count_non_deleted',
                'created_at', 'updated_at',
            ])
            for d in qs:
                ae, an = _user_cell(d.assigned_to)
                ce, cn = _user_cell(d.created_by)
                cl = d.client
                writer.writerow([
                    d.id, d.title, cl.id if cl else '', cl.name if cl else '', cl.status if cl else '',
                    d.status, d.value_usd, d.probability, d.team_size_needed,
                    _json_list(d.tech_requirements),
                    d.start_date.isoformat() if d.start_date else '',
                    d.end_date.isoformat() if d.end_date else '',
                    d.expected_close_date.isoformat() if d.expected_close_date else '',
                    d.description or '', d.order,
                    ae, an, ce, cn,
                    d.notes_live,
                    d.created_at.isoformat() if d.created_at else '',
                    d.updated_at.isoformat() if d.updated_at else '',
                ])

        elif entity == 'tasks':
            now = timezone.now()
            qs = Task.objects.filter(**filters).select_related(
                'assigned_to', 'created_by', 'linked_client', 'linked_deal'
            )
            writer.writerow([
                'id', 'title', 'description', 'priority', 'status', 'deadline', 'is_overdue',
                'assigned_to_email', 'assigned_to_name',
                'created_by_email', 'created_by_name',
                'linked_client_id', 'linked_client_name',
                'linked_deal_id', 'linked_deal_title',
                'created_at', 'updated_at',
            ])
            for t in qs:
                ae, an = _user_cell(t.assigned_to)
                ce, cn = _user_cell(t.created_by)
                overdue = bool(
                    t.deadline and t.deadline < now and t.status != Task.Status.DONE
                )
                lc = t.linked_client
                ld = t.linked_deal
                writer.writerow([
                    t.id, t.title, t.description or '', t.priority, t.status,
                    t.deadline.isoformat() if t.deadline else '',
                    'yes' if overdue else 'no',
                    ae, an, ce, cn,
                    lc.id if lc else '', lc.name if lc else '',
                    ld.id if ld else '', ld.title if ld else '',
                    t.created_at.isoformat() if t.created_at else '',
                    t.updated_at.isoformat() if t.updated_at else '',
                ])
        else:
            writer.writerow(['error', 'unknown entity; use clients, deals, or tasks'])

        raw = buffer.getvalue()
        ts = timezone.now().strftime('%Y%m%d_%H%M')
        filename = f'crm_export_{entity}_{ts}.csv'
        response = HttpResponse('\ufeff' + raw, content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
