from rest_framework import serializers
from .models import Pipeline, Stage, StageChange


class StageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stage
        fields = ['id', 'pipeline', 'name', 'code', 'semantic', 'color', 'order']
        read_only_fields = ['id']


class PipelineSerializer(serializers.ModelSerializer):
    stages = StageSerializer(many=True, read_only=True)

    class Meta:
        model = Pipeline
        fields = ['id', 'kind', 'name', 'is_default', 'order', 'is_active', 'stages']
        read_only_fields = ['id', 'stages']


class StageChangeSerializer(serializers.ModelSerializer):
    from_stage_code = serializers.CharField(source='from_stage.code', read_only=True, default=None)
    to_stage_code = serializers.CharField(source='to_stage.code', read_only=True)
    from_stage_name = serializers.CharField(source='from_stage.name', read_only=True, default=None)
    to_stage_name = serializers.CharField(source='to_stage.name', read_only=True)

    class Meta:
        model = StageChange
        fields = ['id', 'entity_type', 'entity_id', 'from_stage', 'from_stage_code', 'from_stage_name',
                  'to_stage', 'to_stage_code', 'to_stage_name', 'user', 'comment', 'at']
        read_only_fields = ['id', 'at']
