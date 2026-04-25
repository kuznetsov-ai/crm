"""Currency API views — rate lookup + settings per workspace."""
from django.core.management import call_command
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CurrencyRate, Workspace
from .permissions import IsWorkspaceMember


class CurrencyRateView(APIView):
    """GET /api/currency/rate/?base=USD&quote=RUB → latest rate or 404."""
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get(self, request):
        base = request.query_params.get('base', 'USD').upper()
        quote = request.query_params.get('quote', 'RUB').upper()
        row = CurrencyRate.objects.filter(base=base, quote=quote).first()
        if row is None:
            return Response({'detail': 'No rate stored yet.'}, status=404)
        return Response({
            'base': row.base,
            'quote': row.quote,
            'rate': str(row.rate),
            'source': row.source,
            'fetched_at': row.fetched_at,
        })


class CurrencyRateSyncView(APIView):
    """POST /api/currency/rate/sync/ → trigger CBR sync, return fresh rate."""
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def post(self, request):
        try:
            call_command('sync_currency_rate')
        except SystemExit:
            return Response({'detail': 'Rate sync failed. Check server logs.'}, status=502)
        row = CurrencyRate.objects.filter(base='USD', quote='RUB').first()
        if row is None:
            return Response({'detail': 'Sync succeeded but no rate found.'}, status=500)
        return Response({
            'base': row.base,
            'quote': row.quote,
            'rate': str(row.rate),
            'source': row.source,
            'fetched_at': row.fetched_at,
        })


class CurrencySettingsView(APIView):
    """
    GET  /api/currency/settings/ → {'currency': 'USD'}
    PATCH /api/currency/settings/ {'currency': 'RUB'} → update workspace setting
    """
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get(self, request):
        ws: Workspace = request.workspace
        currency = ws.settings.get('currency', 'USD')
        return Response({'currency': currency})

    def patch(self, request):
        ws: Workspace = request.workspace
        currency = request.data.get('currency', '').upper()
        if currency not in ('USD', 'RUB'):
            return Response({'detail': 'currency must be USD or RUB.'}, status=400)
        settings = dict(ws.settings)
        settings['currency'] = currency
        ws.settings = settings
        ws.save(update_fields=['settings'])
        return Response({'currency': currency})
