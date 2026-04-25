import datetime
from decimal import Decimal

from django.db.models import Sum, Q
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from .models import KPITarget
from .serializers import KPITargetSerializer


# ---------------------------------------------------------------------------
# Date range helpers
# ---------------------------------------------------------------------------

def _get_date_range(period: str, year: int, period_number: int):
    """Return (start_dt, end_dt) as timezone-naive UTC datetimes."""
    if period == 'day':
        # period_number = day-of-year 1..366
        start = datetime.datetime(year, 1, 1) + datetime.timedelta(days=period_number - 1)
        end = start + datetime.timedelta(days=1) - datetime.timedelta(seconds=1)

    elif period == 'week':
        # ISO week: period_number 1..53
        start = datetime.datetime.strptime(f'{year}-W{period_number:02d}-1', '%G-W%V-%u')
        end = start + datetime.timedelta(days=7) - datetime.timedelta(seconds=1)

    elif period == 'month':
        start = datetime.datetime(year, period_number, 1)
        if period_number == 12:
            end = datetime.datetime(year + 1, 1, 1) - datetime.timedelta(seconds=1)
        else:
            end = datetime.datetime(year, period_number + 1, 1) - datetime.timedelta(seconds=1)

    elif period == 'quarter':
        first_month = (period_number - 1) * 3 + 1
        start = datetime.datetime(year, first_month, 1)
        last_month = first_month + 2
        if last_month == 12:
            end = datetime.datetime(year + 1, 1, 1) - datetime.timedelta(seconds=1)
        else:
            end = datetime.datetime(year, last_month + 1, 1) - datetime.timedelta(seconds=1)

    elif period == 'year':
        start = datetime.datetime(year, 1, 1)
        end = datetime.datetime(year + 1, 1, 1) - datetime.timedelta(seconds=1)

    else:
        raise ValueError(f'Unknown period: {period}')

    return start, end


def _compute_actual(metric: str, start, end, user_id=None, department=None):
    """Compute actual value for a given metric, optional user or department filter.

    Priority: user_id > department > no filter (company-wide).
    """
    from apps.deals.models import Deal
    from apps.tasks.models import Task
    from apps.clients.models import Client
    from apps.users.models import User

    if user_id:
        user_filter = Q(assigned_to_id=user_id)
    elif department:
        dept_user_ids = User.objects.filter(department=department).values_list('id', flat=True)
        user_filter = Q(assigned_to_id__in=list(dept_user_ids))
    else:
        user_filter = Q()

    if metric == 'deals_count':
        return Decimal(
            Deal.objects.filter(
                user_filter,
                created_at__gte=start,
                created_at__lte=end,
            ).count()
        )

    elif metric == 'revenue_usd':
        result = Deal.objects.filter(
            user_filter,
            status__in=['signed', 'active'],
            created_at__gte=start,
            created_at__lte=end,
        ).aggregate(total=Sum('value_usd'))['total']
        return result or Decimal('0')

    elif metric == 'new_leads':
        return Decimal(
            Deal.objects.filter(
                user_filter,
                status='new_lead',
                created_at__gte=start,
                created_at__lte=end,
            ).count()
        )

    elif metric == 'tasks_done':
        return Decimal(
            Task.objects.filter(
                user_filter,
                status='done',
                updated_at__gte=start,
                updated_at__lte=end,
            ).count()
        )

    elif metric == 'clients_added':
        return Decimal(
            Client.objects.filter(
                user_filter,
                created_at__gte=start,
                created_at__lte=end,
            ).count()
        )

    return Decimal('0')


# ---------------------------------------------------------------------------
# KPITarget CRUD
# ---------------------------------------------------------------------------

class KPITargetListCreateView(WorkspaceScopedViewSetMixin, generics.ListCreateAPIView):
    queryset = KPITarget.objects.all()
    serializer_class = KPITargetSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(workspace=self.request.workspace)

    def get_queryset(self):
        qs = super().get_queryset().select_related('assigned_to')
        user_id = self.request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(assigned_to_id=user_id)
        period = self.request.query_params.get('period')
        if period:
            qs = qs.filter(period=period)
        year = self.request.query_params.get('year')
        if year:
            qs = qs.filter(year=year)
        return qs


class KPITargetDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = KPITarget.objects.select_related('assigned_to')
    serializer_class = KPITargetSerializer
    permission_classes = [IsAuthenticated]


# ---------------------------------------------------------------------------
# KPI Summary — computes actuals on the fly
# ---------------------------------------------------------------------------

class KPISummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        period = request.query_params.get('period', 'month')
        try:
            year = int(request.query_params.get('year', datetime.date.today().year))
            period_number = int(request.query_params.get('period_number', 1))
        except (TypeError, ValueError):
            return Response({'error': 'year and period_number must be integers'}, status=status.HTTP_400_BAD_REQUEST)

        user_id = request.query_params.get('user_id') or None
        if user_id:
            try:
                user_id = int(user_id)
            except ValueError:
                return Response({'error': 'user_id must be an integer'}, status=status.HTTP_400_BAD_REQUEST)

        department = request.query_params.get('department') or None

        try:
            start, end = _get_date_range(period, year, period_number)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # Fetch matching targets filtered by scope:
        #   user_id   → individual target + company-wide fallback
        #   department → department target + company-wide fallback
        #   neither   → all targets (admin overview)
        qs = KPITarget.objects.filter(
            period=period, year=year, period_number=period_number
        ).select_related('assigned_to')

        if user_id:
            qs = qs.filter(Q(assigned_to_id=user_id) | Q(assigned_to__isnull=True))
        elif department:
            qs = qs.filter(
                Q(department=department, assigned_to__isnull=True) |
                Q(assigned_to__isnull=True, department__isnull=True)
            )

        results = []
        for target in qs:
            # Determine effective scope for actual computation
            if target.assigned_to_id:
                actual = _compute_actual(target.metric, start, end, user_id=target.assigned_to_id)
            elif target.department:
                actual = _compute_actual(target.metric, start, end, department=target.department)
            else:
                # Company-level: scope down to user/dept if caller provided one
                actual = _compute_actual(target.metric, start, end, user_id=user_id, department=department)

            target_val = target.target_value
            if target_val > 0:
                percentage = round(float(actual / target_val * 100), 1)
            else:
                percentage = 0.0

            results.append({
                'id': target.id,
                'metric': target.metric,
                'period': target.period,
                'year': target.year,
                'period_number': target.period_number,
                'target_value': str(target_val),
                'actual_value': str(actual),
                'percentage': percentage,
                'assigned_to_id': target.assigned_to_id,
                'assigned_to_name': (
                    target.assigned_to.full_name or target.assigned_to.email
                ) if target.assigned_to else None,
                'department': target.department,
            })

        return Response(results)
