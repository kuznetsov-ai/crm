from rest_framework import generics, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from .models import Favorite
from .serializers import FavoriteSerializer


class FavoriteListView(WorkspaceScopedViewSetMixin, generics.ListCreateAPIView):
    queryset = Favorite.objects.all()
    serializer_class = FavoriteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset().filter(user=self.request.user)
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, workspace=self.request.workspace)


class FavoriteToggleView(APIView):
    """POST with {entity_type, entity_id} — adds favorite, or removes if already present.

    Returns {"favorited": bool}.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ws = getattr(request, 'workspace', None)
        if ws is None:
            raise PermissionDenied('Workspace context is required.')
        entity_type = request.data.get('entity_type')
        entity_id = request.data.get('entity_id')
        if not entity_type or not entity_id:
            return Response({'error': 'entity_type and entity_id required'}, status=status.HTTP_400_BAD_REQUEST)
        existing = Favorite.objects.filter(
            user=request.user, entity_type=entity_type, entity_id=entity_id
        ).first()
        if existing:
            existing.delete()
            return Response({'favorited': False})
        Favorite.objects.create(
            user=request.user, entity_type=entity_type, entity_id=entity_id, workspace=ws
        )
        return Response({'favorited': True}, status=status.HTTP_201_CREATED)
