from rest_framework import serializers
from .models import User, Role, Employee


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'preset', 'can_manage_users', 'can_manage_deals',
                  'can_manage_clients', 'can_view_reports', 'can_manage_settings']


class UserSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), source='role', write_only=True, required=False
    )
    full_name = serializers.CharField(read_only=True)
    permissions = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name',
                  'avatar', 'language', 'role', 'role_id', 'permissions',
                  'is_active', 'created_at']
        read_only_fields = ['id', 'created_at', 'full_name', 'permissions']

    def get_permissions(self, obj):
        defaults = {
            'can_manage_users': False,
            'can_manage_deals': False,
            'can_manage_clients': False,
            'can_view_reports': False,
            'can_manage_settings': False,
        }
        if not obj.role:
            return defaults
        return {
            'can_manage_users': obj.role.can_manage_users,
            'can_manage_deals': obj.role.can_manage_deals,
            'can_manage_clients': obj.role.can_manage_clients,
            'can_view_reports': obj.role.can_view_reports,
            'can_manage_settings': obj.role.can_manage_settings,
        }


class CreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), source='role', required=False
    )

    class Meta:
        model = User
        fields = ['email', 'password', 'first_name', 'last_name', 'language', 'role_id']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class UpdateMeSerializer(serializers.ModelSerializer):
    """Serializer for users updating their own profile — role changes not allowed."""
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'avatar', 'language']


from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class WorkspaceAwareTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        current = getattr(user, 'current_workspace', None)
        token['workspace_slug'] = current.slug if current else None
        return token
