from django.urls import path
from .views import KPITargetListCreateView, KPITargetDetailView, KPISummaryView

urlpatterns = [
    path('targets/', KPITargetListCreateView.as_view(), name='kpi-target-list'),
    path('targets/<int:pk>/', KPITargetDetailView.as_view(), name='kpi-target-detail'),
    path('summary/', KPISummaryView.as_view(), name='kpi-summary'),
]
