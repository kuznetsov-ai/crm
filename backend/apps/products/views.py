from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from .models import Product
from .serializers import ProductSerializer


class ProductViewSet(WorkspaceScopedViewSetMixin, viewsets.ModelViewSet):
    """
    GET    /api/products/        — list active products in the current workspace
    POST   /api/products/        — create a product
    GET    /api/products/{id}/   — retrieve
    PATCH  /api/products/{id}/   — update
    DELETE /api/products/{id}/   — delete
    """
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['is_active', 'default_rate_type']
    search_fields = ['name', 'sku', 'description']
    ordering_fields = ['name', 'created_at', 'default_rate']
    ordering = ['name']
