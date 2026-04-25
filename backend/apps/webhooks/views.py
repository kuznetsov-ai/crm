from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from .models import WebhookEndpoint, WebhookDelivery
from .serializers import WebhookEndpointSerializer, WebhookDeliverySerializer


class EndpointListView(WorkspaceScopedViewSetMixin, generics.ListCreateAPIView):
    queryset = WebhookEndpoint.objects.all()
    serializer_class = WebhookEndpointSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, workspace=self.request.workspace)


class EndpointDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = WebhookEndpoint.objects.all()
    serializer_class = WebhookEndpointSerializer
    permission_classes = [IsAuthenticated]


class DeliveryListView(generics.ListAPIView):
    serializer_class = WebhookDeliverySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return WebhookDelivery.objects.select_related('endpoint').order_by('-created_at')[:200]
