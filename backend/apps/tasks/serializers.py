from rest_framework import serializers
from .models import Task
from apps.users.models import User


class TaskUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name']


class TaskSerializer(serializers.ModelSerializer):
    assigned_to = TaskUserSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source='assigned_to', queryset=User.objects.all(),
        write_only=True, required=False, allow_null=True
    )
    created_by = TaskUserSerializer(read_only=True)
    is_overdue = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)

    class Meta:
        model = Task
        fields = ['id', 'title', 'description', 'assigned_to', 'assigned_to_id',
                  'created_by', 'priority', 'priority_display', 'status', 'status_display',
                  'deadline', 'linked_client', 'linked_deal', 'is_overdue', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'is_overdue', 'created_at', 'updated_at']

    def get_is_overdue(self, obj):
        from django.utils import timezone
        return bool(obj.deadline and obj.deadline < timezone.now() and obj.status != Task.Status.DONE)

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)
