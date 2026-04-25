from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

from .models import Workspace, Membership
from .serializers import WorkspaceSerializer, MembershipSerializer, SwitchSerializer


class WorkspaceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = WorkspaceSerializer
    permission_classes = [IsAuthenticated]
    lookup_field = 'slug'

    def get_queryset(self):
        return Workspace.objects.filter(
            is_active=True, memberships__user=self.request.user
        ).distinct().order_by('name')

    @action(detail=False, methods=['get'])
    def me(self, request):
        qs = self.get_queryset()
        ser = self.get_serializer(qs, many=True)
        current = request.user.current_workspace
        return Response({
            'workspaces': ser.data,
            'current_workspace_slug': current.slug if current else None,
        })

    @action(detail=False, methods=['post'])
    def switch(self, request):
        ser = SwitchSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        target = get_object_or_404(self.get_queryset(), slug=ser.validated_data['slug'])
        request.user.current_workspace = target
        request.user.save(update_fields=['current_workspace'])
        return Response({'slug': target.slug, 'name': target.name})

    @action(detail=True, methods=['get'])
    def members(self, request, slug=None):
        ws = self.get_object()
        qs = Membership.objects.filter(workspace=ws).select_related('user')
        return Response(MembershipSerializer(qs, many=True).data)
