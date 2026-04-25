from rest_framework import serializers
from .models import WebhookEndpoint, WebhookDelivery


class WebhookEndpointSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookEndpoint
        fields = ['id', 'name', 'url', 'events', 'secret', 'active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class WebhookDeliverySerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookDelivery
        fields = ['id', 'endpoint', 'event', 'status_code', 'response_snippet', 'error', 'duration_ms', 'created_at']
