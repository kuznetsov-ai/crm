from django.urls import path
from .views import CalendarEventListCreateView, CalendarEventDetailView

urlpatterns = [
    path('events/', CalendarEventListCreateView.as_view(), name='calendar-event-list'),
    path('events/<int:pk>/', CalendarEventDetailView.as_view(), name='calendar-event-detail'),
]
