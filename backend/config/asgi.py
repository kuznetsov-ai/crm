import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.prod')
django.setup()

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
from apps.chat.routing import websocket_urlpatterns
from apps.chat.middleware import JWTAuthMiddleware

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': JWTAuthMiddleware(
        URLRouter(websocket_urlpatterns)
    ),
})
