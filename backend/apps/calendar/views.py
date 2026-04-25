from rest_framework import generics, permissions
from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from .models import CalendarEvent
from .serializers import CalendarEventSerializer


class CalendarEventListCreateView(WorkspaceScopedViewSetMixin, generics.ListCreateAPIView):
    queryset = CalendarEvent.objects.all()
    serializer_class = CalendarEventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset().filter(created_by=self.request.user)
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(start_datetime__date__gte=date_from)
        if date_to:
            qs = qs.filter(start_datetime__date__lte=date_to)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, workspace=self.request.workspace)


class CalendarEventDetailView(WorkspaceScopedViewSetMixin, generics.RetrieveUpdateDestroyAPIView):
    queryset = CalendarEvent.objects.all()
    serializer_class = CalendarEventSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return super().get_queryset().filter(created_by=self.request.user)
