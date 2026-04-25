from django.urls import path
from .views import (
    DashboardStatsView, ReportsView, ReportsExportView, ProfitabilityView,
    GlobalSearchSchemaView, GlobalSearchView,
)

urlpatterns = [
    path('stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('reports/', ReportsView.as_view(), name='reports'),
    path('reports/export/', ReportsExportView.as_view(), name='reports-export'),
    path('profitability/', ProfitabilityView.as_view(), name='profitability'),
    path('search/schema/', GlobalSearchSchemaView.as_view(), name='global-search-schema'),
    path('search/', GlobalSearchView.as_view(), name='global-search'),
]
