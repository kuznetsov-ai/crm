from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from rest_framework_simplejwt.views import TokenRefreshView
from apps.users.views import WorkspaceAwareTokenObtainPairView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/token/', WorkspaceAwareTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/users/', include('apps.users.urls')),
    path('api/clients/', include('apps.clients.urls')),
    path('api/deals/', include('apps.deals.urls')),
    path('api/tasks/', include('apps.tasks.urls')),
    path('api/dashboard/', include('apps.dashboard.urls')),
    path('api/chat/', include('apps.chat.urls')),
    path('api/backlog/', include('apps.backlog.urls')),
    path('api/kpi/', include('apps.kpi.urls')),
    path('api/events/', include('apps.events.urls')),
    path('api/calendar/', include('apps.calendar.urls')),
    path('api/favorites/', include('apps.favorites.urls')),
    path('api/', include('apps.pipelines.urls')),
    path('api/', include('apps.dictionaries.urls')),
    path('api/ai/', include('apps.ai.urls')),
    path('api/leads/', include('apps.leads.urls')),
    path('api/webhooks/', include('apps.webhooks.urls')),
    path('api/', include('apps.workspaces.urls')),
    path('api/', include('apps.custom_fields.urls')),
    path('api/', include('apps.activities.urls')),
    path('api/', include('apps.products.urls')),
    path('api/demo/', include('apps.demo.urls')),
]

if settings.DEBUG:
    from django.conf.urls.static import static
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
