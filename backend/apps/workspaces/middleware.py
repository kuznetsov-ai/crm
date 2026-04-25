from apps.workspaces.models import Workspace


class WorkspaceMiddleware:
    """Resolve `request.workspace` from X-Workspace-Slug header or user.current_workspace.

    - If user is not authenticated → `request.workspace = None`.
    - Header wins if present AND the user is a member of that workspace.
    - Otherwise falls back to `user.current_workspace` (only if user is a member).
    - Unknown or unauthorized slug → `request.workspace = None`.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.workspace = self._resolve(request)
        return self.get_response(request)

    def _resolve(self, request):
        user = getattr(request, 'user', None)
        if user is None or not getattr(user, 'is_authenticated', False):
            return None

        slug = request.META.get('HTTP_X_WORKSPACE_SLUG')
        if slug:
            ws = Workspace.objects.filter(
                slug=slug, is_active=True, memberships__user=user
            ).first()
            if ws:
                return ws
            # Bad slug → explicit None (don't silently fall through — front-end
            # must notice and re-issue; a silent fall-through would give the
            # user data from the wrong workspace).
            return None

        current = getattr(user, 'current_workspace', None)
        if current and current.is_active and current.memberships.filter(user=user).exists():
            return current
        return None
