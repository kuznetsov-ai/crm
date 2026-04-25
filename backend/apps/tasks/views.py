from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from .models import Task
from .serializers import TaskSerializer


class TaskListView(WorkspaceScopedViewSetMixin, generics.ListCreateAPIView):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'priority', 'assigned_to', 'linked_client', 'linked_deal']
    search_fields = ['title', 'description']
    ordering_fields = ['deadline', 'priority', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        return super().get_queryset().select_related('assigned_to', 'created_by', 'linked_client', 'linked_deal')

    def perform_create(self, serializer):
        serializer.save(workspace=self.request.workspace)


class TaskDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Task.objects.select_related('assigned_to', 'created_by', 'linked_client', 'linked_deal')
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]
