from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from .models import User, Role
from .serializers import UserSerializer, CreateUserSerializer, RoleSerializer
from .permissions import IsAdmin


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        from .serializers import UpdateMeSerializer
        serializer = UpdateMeSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # Return full user representation
        return Response(UserSerializer(request.user).data)


class UserListView(generics.ListCreateAPIView):
    queryset = User.objects.select_related('role').filter(is_active=True).order_by('first_name', 'last_name')
    permission_classes = [IsAuthenticated, IsAdmin]
    filterset_fields = ['role', 'is_active']
    search_fields = ['email', 'first_name', 'last_name']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateUserSerializer
        return UserSerializer

    def create(self, request, *args, **kwargs):
        serializer = CreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=201)


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.select_related('role').filter(is_active=True)
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        user.is_active = False
        user.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RoleListView(generics.ListCreateAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # return all roles without pagination


class RoleDetailView(generics.RetrieveUpdateAPIView):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated, IsAdmin]
    http_method_names = ['get', 'patch']


from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import WorkspaceAwareTokenObtainPairSerializer


class WorkspaceAwareTokenObtainPairView(TokenObtainPairView):
    serializer_class = WorkspaceAwareTokenObtainPairSerializer
