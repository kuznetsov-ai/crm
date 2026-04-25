from rest_framework import serializers
from .models import Source, LostReason


class SourceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Source
        fields = ['id', 'code', 'name', 'is_active', 'order']


class LostReasonSerializer(serializers.ModelSerializer):
    class Meta:
        model = LostReason
        fields = ['id', 'code', 'name', 'is_active', 'order']
