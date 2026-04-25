import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(override=False)

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-prod')
DEBUG = False
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'django_filters',
    # Local
    'apps.workspaces',
    'apps.pipelines',
    'apps.dictionaries',
    'apps.custom_fields',
    'apps.activities',
    'apps.users',
    'apps.clients',
    'apps.deals',
    'apps.leads',
    'apps.tasks',
    'apps.dashboard',
    'apps.chat',
    'apps.backlog',
    'apps.kpi',
    'apps.events',
    'apps.calendar',
    'apps.favorites',
    'apps.ai',
    'apps.webhooks',
    'apps.products',
    'apps.demo',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'apps.workspaces.middleware.WorkspaceMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'
WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [os.environ.get('REDIS_URL', 'redis://localhost:6379/0')],
        },
    },
}

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.debug',
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'studio_crm'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'postgres'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.environ.get('REDIS_URL', 'redis://localhost:6379/0'),
        'OPTIONS': {'CLIENT_CLASS': 'django_redis.client.DefaultClient'},
    }
}

AUTH_USER_MODEL = 'users.User'

# Toggle: set BYPASS_AUTH=true in .env to skip login for demos.
# All auth code is preserved — just flip this flag back to re-enable.
BYPASS_AUTH = os.environ.get('BYPASS_AUTH', 'false').lower() == 'true'

# Demo mode: stubs AI/HH integrations, exposes /api/demo/reset.
# Daily reset is wired through systemd timer on the server (see ARCHITECTURE.md).
DEMO_MODE = os.environ.get('DEMO_MODE', 'false').lower() == 'true'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        ['apps.users.authentication.BypassAuthentication']
        if BYPASS_AUTH else
        ['rest_framework_simplejwt.authentication.JWTAuthentication']
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        ['rest_framework.permissions.AllowAny']
        if BYPASS_AUTH else
        ['rest_framework.permissions.IsAuthenticated']
    ),
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 25,
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': False,  # disabled — blacklisting not configured
}

LANGUAGE_CODE = 'ru-ru'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

from corsheaders.defaults import default_headers
CORS_ALLOW_HEADERS = list(default_headers) + ['x-workspace-slug']
