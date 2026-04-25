from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from .models import Activity
from .serializers import ActivitySerializer


class ActivityViewSet(WorkspaceScopedViewSetMixin, viewsets.ModelViewSet):
    """
    GET  /api/activities/?entity=deal&entity_id=42
    GET  /api/activities/?entity=deal&entity_id=42&types=note,call
    POST /api/activities/
    PATCH/DELETE /api/activities/{id}/
    POST /api/activities/{id}/complete/
    POST /api/activities/{id}/pin/
    """
    queryset = Activity.objects.all()
    serializer_class = ActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params

        entity = params.get('entity')
        entity_id = params.get('entity_id')
        types_csv = params.get('types')

        if entity:
            qs = qs.filter(entity=entity)
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        if types_csv:
            type_list = [t.strip() for t in types_csv.split(',') if t.strip()]
            qs = qs.filter(type__in=type_list)

        return qs.select_related('author').order_by('-is_pinned', '-created_at')

    def perform_create(self, serializer):
        ws = getattr(self.request, 'workspace', None)
        if ws is None:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Workspace context is required.')
        serializer.save(workspace=ws, author=self.request.user)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """POST /api/activities/{id}/complete/ — set completed_at=now()."""
        activity = self.get_object()
        activity.completed_at = timezone.now()
        activity.save(update_fields=['completed_at', 'updated_at'])
        return Response(ActivitySerializer(activity).data)

    @action(detail=True, methods=['post'])
    def pin(self, request, pk=None):
        """POST /api/activities/{id}/pin/ — toggle is_pinned."""
        activity = self.get_object()
        activity.is_pinned = not activity.is_pinned
        activity.save(update_fields=['is_pinned', 'updated_at'])
        return Response(ActivitySerializer(activity).data)
