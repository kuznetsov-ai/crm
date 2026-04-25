from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from .models import CustomFieldDef
from .serializers import CustomFieldDefSerializer, ReorderDefsSerializer


class CustomFieldDefViewSet(WorkspaceScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = CustomFieldDef.objects.all()
    serializer_class = CustomFieldDefSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['entity', 'is_active']

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        serializer = ReorderDefsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ws = getattr(request, 'workspace', None)
        entity = serializer.validated_data['entity']
        ids = serializer.validated_data['ids']
        for order, def_id in enumerate(ids):
            CustomFieldDef.objects.filter(
                pk=def_id, workspace=ws, entity=entity
            ).update(order=order)
        return Response({'status': 'ok'})
