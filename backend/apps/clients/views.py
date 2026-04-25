import csv
import io
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from .models import Client, Contact
from .serializers import ClientSerializer, ClientListSerializer, ContactSerializer


class ClientListView(WorkspaceScopedViewSetMixin, generics.ListCreateAPIView):
    queryset = Client.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'industry', 'company_size', 'budget_range', 'assigned_to', 'risk_level']
    search_fields = ['name', 'industry', 'website', 'tax_id']
    ordering_fields = ['name', 'created_at', 'status', 'risk_score']
    ordering = ['-created_at']

    def get_queryset(self):
        return super().get_queryset().select_related('assigned_to', 'created_by').prefetch_related('contacts')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ClientSerializer
        return ClientListSerializer

    def perform_create(self, serializer):
        serializer.save(workspace=self.request.workspace)


class ClientDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Client.objects.select_related('assigned_to', 'created_by').prefetch_related('contacts')
    serializer_class = ClientSerializer
    permission_classes = [IsAuthenticated]


class ContactListView(generics.ListCreateAPIView):
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Contact.objects.filter(client_id=self.kwargs['client_pk'])

    def perform_create(self, serializer):
        client = generics.get_object_or_404(Client, pk=self.kwargs['client_pk'])
        serializer.save(client=client, workspace=client.workspace)


class ContactDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ContactSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Contact.objects.filter(client_id=self.kwargs['client_pk'])


from .models import ClientDocument, ClientNote, RateCard
from .serializers import ClientDocumentSerializer, ClientNoteSerializer, RateCardSerializer

class ClientDocumentListView(generics.ListCreateAPIView):
    serializer_class = ClientDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ClientDocument.objects.filter(client_id=self.kwargs['client_pk'])

    def perform_create(self, serializer):
        client = generics.get_object_or_404(Client, pk=self.kwargs['client_pk'])
        file = self.request.FILES.get('file')
        serializer.save(
            client=client,
            uploaded_by=self.request.user,
            name=file.name if file else serializer.validated_data.get('name', ''),
            size=file.size if file else 0,
            workspace=client.workspace,
        )


class ClientDocumentDetailView(generics.DestroyAPIView):
    serializer_class = ClientDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ClientDocument.objects.filter(client_id=self.kwargs['client_pk'])


class ClientNoteListView(generics.ListCreateAPIView):
    serializer_class = ClientNoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ClientNote.objects.filter(client_id=self.kwargs['client_pk']).select_related('author')

    def perform_create(self, serializer):
        client = generics.get_object_or_404(Client, pk=self.kwargs['client_pk'])
        note = serializer.save(client=client, author=self.request.user, workspace=client.workspace)
        # Dual-write: also create an Activity so the timeline is populated.
        try:
            from apps.activities.models import Activity
            Activity.objects.create(
                workspace=client.workspace,
                type=Activity.Type.NOTE,
                entity=Activity.Entity.CLIENT,
                entity_id=client.pk,
                subject=note.title or '',
                body=note.body or '',
                author=self.request.user,
                is_pinned=note.pinned,
                meta={'legacy_id': note.pk, 'source': 'ClientNote', 'kind': note.kind},
            )
        except Exception:
            pass  # never break legacy path

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        client_pk = self.kwargs['client_pk']
        response['X-Deprecation'] = (
            f'use /api/activities/?entity=client&entity_id={client_pk}&types=note'
        )
        return response


class ClientNoteDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ClientNoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ClientNote.objects.filter(client_id=self.kwargs['client_pk'])


class RateCardListView(generics.ListCreateAPIView):
    serializer_class = RateCardSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return RateCard.objects.filter(client_id=self.kwargs['client_pk'])

    def perform_create(self, serializer):
        client = generics.get_object_or_404(Client, pk=self.kwargs['client_pk'])
        serializer.save(client=client, workspace=client.workspace)


class RateCardDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RateCardSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return RateCard.objects.filter(client_id=self.kwargs['client_pk'])


class ClientBulkView(APIView):
    """Bulk mutations over an id list.

    POST /api/clients/bulk/ with {action, ids, data?}.
    Supported actions:
      - set_status      data={status}
      - set_assigned    data={assigned_to_id|null}
      - delete          (no data)
    Returns {updated: N}.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        action = request.data.get('action')
        ids = request.data.get('ids') or []
        data = request.data.get('data') or {}
        if not ids or not isinstance(ids, list):
            return Response({'error': 'ids must be a non-empty list'}, status=status.HTTP_400_BAD_REQUEST)
        qs = Client.objects.filter(pk__in=ids)

        if action == 'set_status':
            new_status = data.get('status')
            if new_status not in dict(Client.Status.choices):
                return Response({'error': 'invalid status'}, status=status.HTTP_400_BAD_REQUEST)
            updated = qs.update(status=new_status)
            return Response({'updated': updated})
        if action == 'set_assigned':
            qs.update(assigned_to_id=data.get('assigned_to_id'))
            return Response({'updated': qs.count()})
        if action == 'delete':
            count = qs.count()
            qs.delete()
            return Response({'deleted': count})
        return Response({'error': f'unknown action "{action}"'}, status=status.HTTP_400_BAD_REQUEST)


class ClientSyncView(APIView):
    """POST /api/clients/<id>/sync/ — trigger the async enrichment pipeline."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        from .sync import enqueue_sync
        try:
            client = Client.objects.get(pk=pk)
        except Client.DoesNotExist:
            return Response({'error': 'not found'}, status=status.HTTP_404_NOT_FOUND)
        Client.objects.filter(pk=pk).update(sync_status='pending')
        enqueue_sync(client.id)
        return Response({'queued': True, 'client_id': client.id})


class RiskRecalcView(APIView):
    """POST /api/clients/<id>/risk/recalc/ — recompute risk (respects override unless ?force=1)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        from .risk import apply_risk
        try:
            client = Client.objects.get(pk=pk)
        except Client.DoesNotExist:
            return Response({'error': 'not found'}, status=status.HTTP_404_NOT_FOUND)
        force = str(request.query_params.get('force') or '').lower() in ('1', 'true', 'yes')
        result = apply_risk(client, force=force)
        return Response(result)


class RiskOverrideView(APIView):
    """POST /api/clients/<id>/risk/override/ with {level?, score?, notes?} — manual override.

    Pass {clear: true} to remove the override flag and re-enable rule recomputation.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk: int):
        from django.utils import timezone
        try:
            client = Client.objects.get(pk=pk)
        except Client.DoesNotExist:
            return Response({'error': 'not found'}, status=status.HTTP_404_NOT_FOUND)

        if request.data.get('clear'):
            client.risk_overridden = False
            client.risk_override_by = None
            client.risk_override_at = None
            client.save(update_fields=['risk_overridden', 'risk_override_by', 'risk_override_at', 'updated_at'])
            from .risk import apply_risk
            apply_risk(client, force=True)
            return Response({'cleared': True, 'score': client.risk_score, 'level': client.risk_level})

        level = request.data.get('level')
        score = request.data.get('score')
        notes = request.data.get('notes', '')
        if level not in dict(Client.RiskLevel.choices) and score is None:
            return Response({'error': 'level or score required'}, status=status.HTTP_400_BAD_REQUEST)

        if score is not None:
            client.risk_score = max(0, min(100, int(score)))
        if level:
            client.risk_level = level
        client.risk_notes = notes
        client.risk_overridden = True
        client.risk_override_by = request.user
        client.risk_override_at = timezone.now()
        client.save()
        return Response({
            'score': client.risk_score, 'level': client.risk_level,
            'overridden': True, 'notes': client.risk_notes,
        })


class TaxIdCheckView(APIView):
    """POST /api/clients/check-tax-id/ with {tax_id, country?} — returns possible duplicates.

    Used for the "live hint" during client creation to surface dupes before they are saved.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .risk import validate_tax_id
        tax_id = (request.data.get('tax_id') or '').strip()
        country = (request.data.get('country') or 'RU').upper()
        if not tax_id:
            return Response({'normalized': '', 'valid': True, 'duplicates': []})
        ok, result = validate_tax_id(tax_id, country)
        if not ok:
            return Response({'normalized': '', 'valid': False, 'reason': result, 'duplicates': []})
        matches = list(
            Client.objects.filter(tax_id=result, tax_id_country=country)
                .values('id', 'name', 'status', 'country', 'industry')[:5]
        )
        return Response({'normalized': result, 'valid': True, 'duplicates': matches})


class ClientImportView(APIView):
    """CSV import for clients.

    POST multipart with:
      - file:    CSV file (utf-8, comma-separated, first row = headers)
      - dry_run: if present and truthy, only validates without creating rows

    Recognized headers (case-insensitive, any of):
      name / company / client_name
      industry
      country
      website
      status / stage
      company_size / size
      budget_range / budget
      description / notes
    """
    permission_classes = [IsAuthenticated]
    parser_classes = ()  # accept multipart via DRF default

    def post(self, request):
        f = request.FILES.get('file')
        if not f:
            return Response({'error': 'file required'}, status=status.HTTP_400_BAD_REQUEST)
        dry_run = str(request.data.get('dry_run') or '').lower() in ('1', 'true', 'yes', 'on')
        try:
            raw = f.read().decode('utf-8-sig')
        except UnicodeDecodeError:
            return Response({'error': 'file must be UTF-8'}, status=status.HTTP_400_BAD_REQUEST)
        reader = csv.DictReader(io.StringIO(raw))

        ws = getattr(request, 'workspace', None)

        created, errors, preview = 0, [], []
        header_map = {
            'name': ['name', 'company', 'client_name', 'название', 'компания'],
            'industry': ['industry', 'индустрия', 'отрасль'],
            'country': ['country', 'страна'],
            'website': ['website', 'site', 'url', 'сайт'],
            'status': ['status', 'stage', 'статус'],
            'company_size': ['company_size', 'size', 'размер'],
            'budget_range': ['budget_range', 'budget', 'бюджет'],
            'description': ['description', 'notes', 'описание', 'заметки'],
        }

        def normalize_header(h: str) -> str | None:
            low = (h or '').strip().lower()
            for field, aliases in header_map.items():
                if low in aliases:
                    return field
            return None

        for row_idx, row in enumerate(reader, start=2):
            cleaned = {}
            for k, v in row.items():
                key = normalize_header(k)
                if key:
                    cleaned[key] = (v or '').strip()
            if not cleaned.get('name'):
                errors.append({'row': row_idx, 'reason': 'missing name'})
                continue
            payload = {
                'name': cleaned.get('name'),
                'industry': cleaned.get('industry', ''),
                'country': cleaned.get('country', ''),
                'website': cleaned.get('website', ''),
                'status': cleaned.get('status') or 'lead',
                'company_size': cleaned.get('company_size', ''),
                'budget_range': cleaned.get('budget_range', ''),
                'description': cleaned.get('description', ''),
            }
            preview.append(payload)
            if not dry_run:
                try:
                    Client.objects.create(created_by=request.user, workspace=ws, **payload)
                    created += 1
                except Exception as exc:
                    errors.append({'row': row_idx, 'reason': str(exc)})

        return Response({
            'created': created,
            'errors': errors,
            'preview': preview[:20] if dry_run else [],
            'total_rows': len(preview),
            'dry_run': dry_run,
        })
