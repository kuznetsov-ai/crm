from rest_framework.authentication import BaseAuthentication


class BypassAuthentication(BaseAuthentication):
    """
    Auto-authenticates as admin when BYPASS_AUTH=true in settings.
    All original auth code is preserved — remove this class and
    revert settings to re-enable auth.
    """
    def authenticate(self, request):
        from django.contrib.auth import get_user_model
        from apps.workspaces.models import Workspace, Membership
        User = get_user_model()
        try:
            user = User.objects.filter(email='demo@studio.crm', is_active=True).first()
            if not user:
                return None
            ws = Workspace.objects.filter(slug='demo').first() or Workspace.objects.first()
            if ws:
                Membership.objects.get_or_create(
                    workspace=ws, user=user, defaults={'role': 'admin'}
                )
                if not user.current_workspace_id:
                    user.current_workspace = ws
                    user.save(update_fields=['current_workspace'])
            return (user, None)
        except Exception:
            return None
