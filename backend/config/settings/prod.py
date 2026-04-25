from .base import *
import os

# Hard crash if SECRET_KEY not set in prod — never fall back silently
SECRET_KEY = os.environ['SECRET_KEY']

# Enforce non-empty ALLOWED_HOSTS
_allowed = os.environ.get('ALLOWED_HOSTS', '').split(',')
ALLOWED_HOSTS = [h.strip() for h in _allowed if h.strip()]
if not ALLOWED_HOSTS:
    raise RuntimeError('ALLOWED_HOSTS must be set in production')

CORS_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',') if o.strip()]
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Only init Sentry when DSN is actually provided
if dsn := os.environ.get('SENTRY_DSN'):
    import sentry_sdk
    sentry_sdk.init(dsn=dsn, traces_sample_rate=0.1)
