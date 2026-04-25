from rest_framework_simplejwt.tokens import AccessToken


def build_access_token(user):
    token = AccessToken.for_user(user)
    current = getattr(user, 'current_workspace', None)
    token['workspace_slug'] = current.slug if current else None
    return token
