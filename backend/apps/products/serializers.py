from rest_framework import serializers
from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = [
            'id', 'workspace', 'name', 'sku', 'unit',
            'default_rate', 'default_rate_type',
            'description', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'workspace', 'created_at']
