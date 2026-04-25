from rest_framework import serializers
from .models import Deal, DealNote, DealItem
from apps.users.models import User
from apps.clients.models import Client
from apps.dictionaries.models import Source, LostReason
from apps.custom_fields.values import read_values, write_values


class DealUserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    class Meta:
        model = User
        fields = ['id', 'email', 'full_name']


class DealClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = ['id', 'name', 'status']


class DealNoteSerializer(serializers.ModelSerializer):
    author = DealUserSerializer(read_only=True)

    class Meta:
        model = DealNote
        fields = ['id', 'deal', 'author', 'text', 'is_deleted', 'created_at', 'updated_at']
        read_only_fields = ['id', 'author', 'deal', 'created_at', 'updated_at']


class DealItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True, default=None)

    class Meta:
        model = DealItem
        fields = [
            'id', 'product', 'product_name',
            'role', 'ratecard_role', 'rate', 'rate_type',
            'quantity', 'months', 'hours', 'subtotal', 'note', 'order',
        ]
        read_only_fields = ['id', 'subtotal', 'product_name']


class DealSerializer(serializers.ModelSerializer):
    assigned_to = DealUserSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        source='assigned_to', queryset=User.objects.all(),
        write_only=True, required=False, allow_null=True
    )
    client = DealClientSerializer(read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        source='client', queryset=Client.objects.all(), write_only=True
    )
    created_by = DealUserSerializer(read_only=True)
    notes_count = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    pipeline_name = serializers.CharField(source='pipeline.name', read_only=True, default=None)
    stage_name = serializers.CharField(source='stage.name', read_only=True, default=None)
    stage_code = serializers.CharField(source='stage.code', read_only=True, default=None)
    stage_semantic = serializers.CharField(source='stage.semantic', read_only=True, default=None)
    source_name = serializers.CharField(source='source.name', read_only=True, default=None)
    lost_reason_name = serializers.CharField(source='lost_reason.name', read_only=True, default=None)
    custom_fields = serializers.SerializerMethodField()
    items = DealItemSerializer(many=True, read_only=True)
    items_subtotal = serializers.SerializerMethodField()
    value_rub = serializers.SerializerMethodField()

    class Meta:
        model = Deal
        fields = ['id', 'title', 'client', 'client_id', 'assigned_to', 'assigned_to_id',
                  'created_by', 'status', 'status_display', 'pipeline', 'stage',
                  'pipeline_name', 'stage_name', 'stage_code', 'stage_semantic',
                  'source', 'source_name', 'lost_reason', 'lost_reason_name', 'lost_comment',
                  'value_usd', 'value_rub', 'amount_override', 'probability', 'team_size_needed',
                  'tech_requirements', 'start_date', 'end_date', 'expected_close_date',
                  'description', 'order', 'notes_count', 'custom_fields',
                  'items', 'items_subtotal', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def get_items_subtotal(self, obj):
        from decimal import Decimal
        total = sum(item.subtotal for item in obj.items.all()) if obj.pk else Decimal('0')
        return str(total)

    def get_value_rub(self, obj):
        """Return value_usd converted to RUB using the latest stored rate, or None."""
        from apps.workspaces.models import CurrencyRate
        try:
            row = CurrencyRate.objects.filter(base='USD', quote='RUB').first()
            if row is None:
                return None
            return str((obj.value_usd * row.rate).quantize(obj.value_usd))
        except Exception:
            return None

    def get_notes_count(self, obj):
        return obj.notes.filter(is_deleted=False).count()

    def get_custom_fields(self, obj):
        ws = getattr(self.context.get('request'), 'workspace', None) or getattr(obj, 'workspace', None)
        if ws is None:
            return {}
        return read_values('deal', obj.pk, ws)

    def validate(self, attrs):
        # Determine the stage after this save
        stage = attrs.get('stage') or getattr(self.instance, 'stage', None)
        # Determine lost_reason: from incoming data, or existing on the instance
        if 'lost_reason' in attrs:
            lost_reason = attrs['lost_reason']
        elif self.instance is not None:
            lost_reason = self.instance.lost_reason
        else:
            lost_reason = None

        if stage and getattr(stage, 'semantic', None) == 'lost' and lost_reason is None:
            raise serializers.ValidationError({
                'lost_reason': 'lost_reason is required when stage.semantic == "lost".'
            })
        return attrs

    def create(self, validated_data):
        cf_payload = validated_data.pop('custom_fields', None)
        validated_data['created_by'] = self.context['request'].user
        instance = super().create(validated_data)
        if cf_payload:
            ws = getattr(self.context.get('request'), 'workspace', None) or getattr(instance, 'workspace', None)
            if ws:
                write_values('deal', instance.pk, ws, cf_payload)
        return instance

    def update(self, instance, validated_data):
        cf_payload = validated_data.pop('custom_fields', None)
        instance = super().update(instance, validated_data)
        if cf_payload is not None:
            ws = getattr(self.context.get('request'), 'workspace', None) or getattr(instance, 'workspace', None)
            if ws:
                write_values('deal', instance.pk, ws, cf_payload)
        return instance

    def to_internal_value(self, data):
        # Extract custom_fields before DRF validates unknown fields
        cf_payload = data.get('custom_fields', None)
        ret = super().to_internal_value(
            {k: v for k, v in data.items() if k != 'custom_fields'}
        )
        if cf_payload is not None:
            ret['custom_fields'] = cf_payload
        return ret


class ReorderItemSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    order = serializers.IntegerField(min_value=0)


from .models import DealDocument

class DealDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    file = serializers.FileField(write_only=True, required=True)

    class Meta:
        model = DealDocument
        fields = ['id', 'name', 'size', 'file', 'url', 'uploaded_by_name', 'created_at']
        read_only_fields = ['id', 'name', 'size', 'url', 'uploaded_by_name', 'created_at']

    def get_uploaded_by_name(self, obj):
        return obj.uploaded_by.full_name or obj.uploaded_by.email if obj.uploaded_by else None

    def get_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None
