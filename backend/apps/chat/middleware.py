from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get('query_string', b'').decode()
        params = parse_qs(query_string)
        token = params.get('token', [None])[0]
        scope['user'] = await self._get_user(token)
        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def _get_user(self, token):
        from django.contrib.auth.models import AnonymousUser
        if not token:
            return AnonymousUser()
        try:
            from rest_framework_simplejwt.tokens import AccessToken
            from apps.users.models import User
            payload = AccessToken(token)
            return User.objects.get(id=payload['user_id'])
        except Exception:
            return AnonymousUser()
