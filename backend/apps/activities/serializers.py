from rest_framework import serializers
from .models import Activity


class AuthorSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    full_name = serializers.SerializerMethodField()

    def get_full_name(self, obj):
        return getattr(obj, 'full_name', '') or f'{obj.first_name} {obj.last_name}'.strip()


class ActivitySerializer(serializers.ModelSerializer):
    author = AuthorSerializer(read_only=True)

    class Meta:
        model = Activity
        fields = [
            'id', 'workspace', 'type', 'entity', 'entity_id',
            'author', 'subject', 'body', 'meta',
            'due_at', 'completed_at', 'is_pinned',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'workspace', 'author', 'created_at', 'updated_at']
