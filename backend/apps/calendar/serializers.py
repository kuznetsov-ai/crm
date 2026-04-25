from rest_framework import serializers
from .models import CalendarEvent


class CalendarEventSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CalendarEvent
        fields = [
            'id',
            'title',
            'event_type',
            'start_datetime',
            'end_datetime',
            'all_day',
            'description',
            'color',
            'created_by',
            'created_by_name',
            'created_at',
        ]
        read_only_fields = ['created_by', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return getattr(obj.created_by, 'full_name', None) or obj.created_by.email
        return None

    def validate(self, attrs):
        # For partial updates (PATCH) fall back to the existing instance values
        start = attrs.get('start_datetime') or getattr(self.instance, 'start_datetime', None)
        end = attrs.get('end_datetime')
        if end is None and 'end_datetime' not in attrs:
            end = getattr(self.instance, 'end_datetime', None)
        if start and end and end <= start:
            raise serializers.ValidationError({
                'end_datetime': 'end_datetime must be strictly greater than start_datetime',
            })
        return attrs
