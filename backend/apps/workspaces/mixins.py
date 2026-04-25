from rest_framework.exceptions import PermissionDenied

from .permissions import IsWorkspaceMember


class WorkspaceScopedViewSetMixin:
    """
    Mix into any DRF ViewSet whose model has a `workspace` FK. Behaviour:
    - `get_queryset` → filters to `request.workspace` via `.for_workspace(...)`.
    - `perform_create` → assigns `workspace=request.workspace` on save.
    - Requires IsWorkspaceMember permission (appended to `permission_classes`).
    """

    def get_permissions(self):
        perms = list(super().get_permissions())
        perms.append(IsWorkspaceMember())
        return perms

    def get_queryset(self):
        base = self.queryset if self.queryset is not None else super().get_queryset()
        ws = getattr(self.request, 'workspace', None)
        if ws is None:
            return base.none()
        base_qs = base.all() if hasattr(base, 'all') else base
        if hasattr(base_qs, 'for_workspace'):
            return base_qs.for_workspace(ws)
        return base_qs.filter(workspace=ws)

    def perform_create(self, serializer):
        ws = getattr(self.request, 'workspace', None)
        if ws is None:
            raise PermissionDenied('Workspace context is required.')
        serializer.save(workspace=ws)
