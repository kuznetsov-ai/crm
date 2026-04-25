from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from apps.workspaces.permissions import IsWorkspaceMember
from .models import Pipeline, Stage
from .serializers import PipelineSerializer, StageSerializer


class PipelineViewSet(WorkspaceScopedViewSetMixin, viewsets.ModelViewSet):
    serializer_class = PipelineSerializer
    queryset = Pipeline.objects.prefetch_related('stages').all()
    filterset_fields = ['kind']


class StageViewSet(viewsets.ModelViewSet):
    """Stage has no direct workspace FK — scope via pipeline.workspace."""
    serializer_class = StageSerializer
    queryset = Stage.objects.all()
    filterset_fields = ['pipeline']
    permission_classes = [IsAuthenticated, IsWorkspaceMember]

    def get_queryset(self):
        ws = getattr(self.request, 'workspace', None)
        if ws is None:
            return Stage.objects.none()
        return Stage.objects.filter(pipeline__workspace=ws).select_related('pipeline')

    def perform_create(self, serializer):
        pipeline = serializer.validated_data['pipeline']
        ws = getattr(self.request, 'workspace', None)
        if ws is None or pipeline.workspace != ws:
            raise PermissionDenied('Pipeline is in a different workspace.')
        serializer.save()

    def perform_update(self, serializer):
        pipeline = serializer.validated_data.get('pipeline') or serializer.instance.pipeline
        ws = getattr(self.request, 'workspace', None)
        if ws is None or pipeline.workspace != ws:
            raise PermissionDenied('Pipeline is in a different workspace.')
        serializer.save()
