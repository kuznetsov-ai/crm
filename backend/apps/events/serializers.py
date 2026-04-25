from rest_framework import serializers
from .models import Event


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = '__all__'
        read_only_fields = (
            'assigned_to',
            'created_at',
            'updated_at',
            'last_synced_at',
        )
