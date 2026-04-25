from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from .models import Deal, DealNote, DealItem
from .serializers import DealSerializer, DealNoteSerializer, ReorderItemSerializer, DealItemSerializer


class DealListView(WorkspaceScopedViewSetMixin, generics.ListCreateAPIView):
    queryset = Deal.objects.all()
    serializer_class = DealSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'client', 'assigned_to']
    search_fields = ['title', 'client__name']
    ordering = ['status', 'order']

    def get_queryset(self):
        return super().get_queryset().select_related('client', 'assigned_to', 'created_by').prefetch_related('items')

    def perform_create(self, serializer):
        serializer.save(workspace=self.request.workspace)


class DealDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Deal.objects.select_related('client', 'assigned_to', 'created_by').prefetch_related('items')
    serializer_class = DealSerializer
    permission_classes = [IsAuthenticated]


class DealReorderView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ReorderItemSerializer(data=request.data, many=True)
        serializer.is_valid(raise_exception=True)
        for item in serializer.validated_data:
            Deal.objects.filter(pk=item['id']).update(order=item['order'])
        return Response({'status': 'ok'})


class DealNoteListView(generics.ListCreateAPIView):
    serializer_class = DealNoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DealNote.objects.filter(
            deal_id=self.kwargs['deal_pk'], is_deleted=False
        ).select_related('author')

    def perform_create(self, serializer):
        deal = generics.get_object_or_404(Deal, pk=self.kwargs['deal_pk'])
        note = serializer.save(deal=deal, author=self.request.user, workspace=deal.workspace)
        # Dual-write: also create an Activity for the timeline.
        try:
            from apps.activities.models import Activity
            Activity.objects.create(
                workspace=deal.workspace,
                type=Activity.Type.NOTE,
                entity=Activity.Entity.DEAL,
                entity_id=deal.pk,
                body=note.text or '',
                author=self.request.user,
                meta={'legacy_id': note.pk, 'source': 'DealNote'},
            )
        except Exception:
            pass  # never break legacy path

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        deal_pk = self.kwargs['deal_pk']
        response['X-Deprecation'] = (
            f'use /api/activities/?entity=deal&entity_id={deal_pk}&types=note'
        )
        return response


class DealNoteDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = DealNoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DealNote.objects.filter(deal_id=self.kwargs['deal_pk'])

    def destroy(self, request, *args, **kwargs):
        note = self.get_object()
        note.is_deleted = True
        note.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def update(self, request, *args, **kwargs):
        note = self.get_object()
        if note.author != request.user:
            return Response({'error': "Cannot edit another user's note"}, status=403)
        return super().update(request, *args, **kwargs)


from .models import DealDocument
from .serializers import DealDocumentSerializer

class DealDocumentListView(generics.ListCreateAPIView):
    serializer_class = DealDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DealDocument.objects.filter(deal_id=self.kwargs['deal_pk'])

    def perform_create(self, serializer):
        deal = generics.get_object_or_404(Deal, pk=self.kwargs['deal_pk'])
        file = self.request.FILES.get('file')
        serializer.save(
            deal=deal,
            uploaded_by=self.request.user,
            name=file.name if file else serializer.validated_data.get('name', ''),
            size=file.size if file else 0,
            workspace=deal.workspace,
        )


class DealDocumentDetailView(generics.DestroyAPIView):
    serializer_class = DealDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DealDocument.objects.filter(deal_id=self.kwargs['deal_pk'])


class DealHistoryView(generics.ListAPIView):
    """GET /api/deals/<pk>/history/ — stage change log for a deal."""
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from apps.pipelines.models import StageChange
        return StageChange.objects.filter(
            entity_type='deal', entity_id=self.kwargs['pk']
        ).order_by('-at')

    def list(self, request, *args, **kwargs):
        from apps.pipelines.serializers import StageChangeSerializer
        # Enforce workspace scoping: the deal must exist in the current workspace.
        ws = getattr(request, 'workspace', None)
        deal_qs = Deal.objects.all()
        if ws is not None:
            deal_qs = deal_qs.filter(workspace=ws)
        generics.get_object_or_404(deal_qs, pk=self.kwargs['pk'])
        qs = self.get_queryset()
        return Response(StageChangeSerializer(qs, many=True).data)


class DealItemListView(generics.ListCreateAPIView):
    """GET /api/deals/{deal_pk}/items/ — list; POST — create."""
    serializer_class = DealItemSerializer
    permission_classes = [IsAuthenticated]

    def _get_deal(self):
        ws = getattr(self.request, 'workspace', None)
        qs = Deal.objects.all()
        if ws is not None:
            qs = qs.filter(workspace=ws)
        return generics.get_object_or_404(qs, pk=self.kwargs['deal_pk'])

    def get_queryset(self):
        return DealItem.objects.filter(deal_id=self.kwargs['deal_pk'])

    def perform_create(self, serializer):
        deal = self._get_deal()
        serializer.save(deal=deal)


class DealItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    """PATCH/DELETE /api/deals/{deal_pk}/items/{pk}/."""
    serializer_class = DealItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DealItem.objects.filter(deal_id=self.kwargs['deal_pk'])


class DealItemReorderView(APIView):
    """POST /api/deals/{deal_pk}/items/reorder/ body: [id, id, id] — assign order by position."""
    permission_classes = [IsAuthenticated]

    def post(self, request, deal_pk):
        ids = request.data
        if not isinstance(ids, list):
            return Response({'error': 'Expected a list of item ids.'}, status=status.HTTP_400_BAD_REQUEST)
        for position, item_id in enumerate(ids):
            DealItem.objects.filter(pk=item_id, deal_id=deal_pk).update(order=position)
        return Response({'status': 'ok'})
