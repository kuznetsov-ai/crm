from django.urls import path
from .views import EndpointListView, EndpointDetailView, DeliveryListView

urlpatterns = [
    path('endpoints/', EndpointListView.as_view(), name='webhook-endpoint-list'),
    path('endpoints/<int:pk>/', EndpointDetailView.as_view(), name='webhook-endpoint-detail'),
    path('deliveries/', DeliveryListView.as_view(), name='webhook-delivery-list'),
]
