from rest_framework import viewsets, permissions
from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from .models import Event
from .serializers import EventSerializer


class EventViewSet(WorkspaceScopedViewSetMixin, viewsets.ModelViewSet):
    queryset = Event.objects.all()
    serializer_class = EventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Only show events assigned to the current user within the workspace
        return super().get_queryset().filter(assigned_to=self.request.user)

    def perform_create(self, serializer):
        serializer.save(assigned_to=self.request.user, workspace=self.request.workspace)
