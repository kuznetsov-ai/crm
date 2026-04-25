from django.apps import AppConfig


class ChatConfig(AppConfig):
    name = 'apps.chat'
    verbose_name = 'Chat'

    def ready(self):
        import apps.chat.signals  # noqa: F401 — wire up signal receivers
