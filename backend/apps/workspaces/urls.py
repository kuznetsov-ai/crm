from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import WorkspaceViewSet
from .currency_views import CurrencyRateView, CurrencyRateSyncView, CurrencySettingsView


router = DefaultRouter()
router.register(r'workspaces', WorkspaceViewSet, basename='workspaces')

urlpatterns = router.urls + [
    path('currency/rate/', CurrencyRateView.as_view(), name='currency-rate'),
    path('currency/rate/sync/', CurrencyRateSyncView.as_view(), name='currency-rate-sync'),
    path('currency/settings/', CurrencySettingsView.as_view(), name='currency-settings'),
]
