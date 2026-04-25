from rest_framework import serializers
from .models import KPITarget
from apps.users.models import User


class KPITargetSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source='assigned_to',
        queryset=User.objects.all(),
        write_only=False,
        required=False,
        allow_null=True,
    )

    class Meta:
        model = KPITarget
        fields = [
            'id', 'assigned_to_id', 'assigned_to_name',
            'department',
            'metric', 'period', 'year', 'period_number',
            'target_value', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'assigned_to_name']

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.full_name or obj.assigned_to.email
        return None
