from rest_framework import viewsets
from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from .models import Source, LostReason
from .serializers import SourceSerializer, LostReasonSerializer


class SourceViewSet(WorkspaceScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Source.objects.all()
    serializer_class = SourceSerializer


class LostReasonViewSet(WorkspaceScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = LostReason.objects.all()
    serializer_class = LostReasonSerializer
