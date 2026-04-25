from rest_framework.permissions import BasePermission


class IsWorkspaceMember(BasePermission):
    """Require ``request.workspace`` to be set.

    Normally the WorkspaceMiddleware resolves ``request.workspace`` from the
    ``X-Workspace-Slug`` header or ``user.current_workspace``.  However, in
    DRF test requests that use ``force_authenticate`` the middleware runs
    before DRF authentication, so ``request.user`` is ``AnonymousUser`` at
    middleware time and the middleware returns ``None``.

    As a fallback this permission re-runs the same resolution logic using the
    DRF-authenticated user so that tests (and any other scenario where the
    middleware missed the user) still work correctly.
    """

    message = 'Workspace context is required.'

    def has_permission(self, request, view):
        ws = getattr(request, 'workspace', None)
        if ws is not None:
            return True

        # Attempt lazy resolution using the DRF-authenticated user.
        user = getattr(request, 'user', None)
        if user is None or not getattr(user, 'is_authenticated', False):
            return False

        ws = self._resolve(request, user)
        if ws is None:
            return False

        # Cache on the underlying Django request so the rest of the view
        # stack (get_queryset, perform_create) picks it up.
        try:
            request._request.workspace = ws  # DRF Request wraps Django request
        except AttributeError:
            pass
        request.workspace = ws  # also set on DRF request for direct access
        return True

    @staticmethod
    def _resolve(request, user):
        from apps.workspaces.models import Workspace

        slug = request.META.get('HTTP_X_WORKSPACE_SLUG')
        if slug:
            return Workspace.objects.filter(
                slug=slug, is_active=True, memberships__user=user
            ).first()

        current = getattr(user, 'current_workspace', None)
        if current and current.is_active and current.memberships.filter(user=user).exists():
            return current
        return None
