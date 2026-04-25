from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.workspaces.mixins import WorkspaceScopedViewSetMixin
from .models import BacklogItem, BacklogComment
from .serializers import BacklogItemSerializer, BacklogCommentSerializer


class BacklogListView(WorkspaceScopedViewSetMixin, generics.ListCreateAPIView):
    queryset = BacklogItem.objects.all()
    serializer_class = BacklogItemSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['status']

    def get_queryset(self):
        return super().get_queryset().select_related('author')

    def perform_create(self, serializer):
        serializer.save(workspace=self.request.workspace)


class BacklogDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = BacklogItem.objects.select_related('author')
    serializer_class = BacklogItemSerializer
    permission_classes = [IsAuthenticated]


class BacklogVoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            item = BacklogItem.objects.get(pk=pk)
        except BacklogItem.DoesNotExist:
            return Response({'error': 'Not found'}, status=404)
        item.votes += 1
        item.save()
        return Response({'votes': item.votes})


class BacklogCommentListView(generics.ListCreateAPIView):
    serializer_class = BacklogCommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BacklogComment.objects.filter(item_id=self.kwargs['item_pk']).select_related('author')

    def perform_create(self, serializer):
        item = generics.get_object_or_404(BacklogItem, pk=self.kwargs['item_pk'])
        serializer.save(item=item, author=self.request.user, workspace=item.workspace)
