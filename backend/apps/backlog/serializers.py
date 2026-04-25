from rest_framework import serializers
from .models import BacklogItem, BacklogComment
from apps.users.models import User


class BacklogUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'full_name']


class BacklogCommentSerializer(serializers.ModelSerializer):
    author = BacklogUserSerializer(read_only=True)
    class Meta:
        model = BacklogComment
        fields = ['id', 'item', 'author', 'text', 'created_at']
        read_only_fields = ['id', 'author', 'item', 'created_at']


class BacklogItemSerializer(serializers.ModelSerializer):
    author = BacklogUserSerializer(read_only=True)
    comments_count = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)

    class Meta:
        model = BacklogItem
        fields = ['id', 'title', 'description', 'status', 'status_display', 'priority', 'priority_display',
                  'author', 'votes', 'order', 'comments_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'author', 'created_at', 'updated_at']

    def get_comments_count(self, obj):
        return obj.comments.count()

    def create(self, validated_data):
        validated_data['author'] = self.context['request'].user
        return super().create(validated_data)
