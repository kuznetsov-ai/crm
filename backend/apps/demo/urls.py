from django.urls import path

from . import views

urlpatterns = [
    path('info', views.info, name='demo-info'),
    path('reset', views.reset, name='demo-reset'),
]
