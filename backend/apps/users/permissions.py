from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsAdmin(BasePermission):
    """Allows access only to users with can_manage_users permission."""
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role and
            request.user.role.can_manage_users
        )


class CanManageDeals(BasePermission):
    """Read allowed for all authenticated; write requires can_manage_deals."""
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user.role and request.user.role.can_manage_deals)
