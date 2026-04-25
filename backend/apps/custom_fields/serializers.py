from rest_framework import serializers
from .models import CustomFieldDef


class CustomFieldDefSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomFieldDef
        fields = [
            'id', 'workspace', 'entity', 'code', 'label', 'type',
            'options', 'required', 'order', 'is_active', 'help_text',
        ]
        read_only_fields = ['id', 'workspace']


class ReorderDefsSerializer(serializers.Serializer):
    entity = serializers.CharField()
    ids = serializers.ListField(child=serializers.IntegerField(), min_length=1)
