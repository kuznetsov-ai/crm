from rest_framework import serializers

from .models import Workspace, Membership


class WorkspaceSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = ['id', 'slug', 'name', 'subdomain', 'is_active', 'settings', 'role']
        read_only_fields = ['id', 'is_active', 'role']

    def get_role(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        if not user or not user.is_authenticated:
            return None
        m = Membership.objects.filter(workspace=obj, user=user).first()
        return m.role if m else None


class MembershipSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = Membership
        fields = ['id', 'user', 'user_email', 'user_name', 'role', 'joined_at']
        read_only_fields = ['id', 'user_email', 'user_name', 'joined_at']


class SwitchSerializer(serializers.Serializer):
    slug = serializers.SlugField(max_length=64)
