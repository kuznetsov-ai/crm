from rest_framework import serializers
from .models import Lead
from apps.users.models import User
from apps.custom_fields.values import read_values, write_values


class LeadUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = ['id', 'email', 'full_name']


class LeadSerializer(serializers.ModelSerializer):
    assignee = LeadUserSerializer(read_only=True)
    assignee_id = serializers.PrimaryKeyRelatedField(
        source='assignee', queryset=User.objects.all(),
        write_only=True, required=False, allow_null=True,
    )

    # Nested read-only display fields
    pipeline_name = serializers.CharField(source='pipeline.name', read_only=True, default=None)
    stage_name = serializers.CharField(source='stage.name', read_only=True, default=None)
    stage_code = serializers.CharField(source='stage.code', read_only=True, default=None)
    stage_semantic = serializers.CharField(source='stage.semantic', read_only=True, default=None)
    source_name = serializers.CharField(source='source.name', read_only=True, default=None)
    lost_reason_name = serializers.CharField(source='lost_reason.name', read_only=True, default=None)
    assignee_email = serializers.CharField(source='assignee.email', read_only=True, default=None)
    converted_client_name = serializers.SerializerMethodField()
    custom_fields = serializers.SerializerMethodField()

    class Meta:
        model = Lead
        fields = [
            'id', 'title', 'first_name', 'last_name', 'phone', 'email',
            'company_name', 'tax_id', 'website',
            'pipeline', 'stage', 'source', 'lost_reason', 'lost_comment',
            'pipeline_name', 'stage_name', 'stage_code', 'stage_semantic',
            'source_name', 'lost_reason_name',
            'opportunity', 'currency',
            'assignee', 'assignee_id', 'assignee_email',
            'converted_client', 'converted_deal', 'converted_at', 'converted_client_name',
            'custom_fields',
            'workspace', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'converted_client', 'converted_deal', 'converted_at',
            'created_at', 'updated_at', 'workspace',
        ]

    def get_converted_client_name(self, obj):
        if obj.converted_client_id and obj.converted_client:
            return obj.converted_client.name
        return None

    def get_custom_fields(self, obj):
        ws = getattr(self.context.get('request'), 'workspace', None) or getattr(obj, 'workspace', None)
        if ws is None:
            return {}
        return read_values('lead', obj.pk, ws)

    def update(self, instance, validated_data):
        cf_payload = validated_data.pop('custom_fields', None)
        instance = super().update(instance, validated_data)
        if cf_payload is not None:
            ws = getattr(self.context.get('request'), 'workspace', None) or getattr(instance, 'workspace', None)
            if ws:
                write_values('lead', instance.pk, ws, cf_payload)
        return instance

    def to_internal_value(self, data):
        cf_payload = data.get('custom_fields', None)
        ret = super().to_internal_value(
            {k: v for k, v in data.items() if k != 'custom_fields'}
        )
        if cf_payload is not None:
            ret['custom_fields'] = cf_payload
        return ret
