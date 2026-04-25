import pytest
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import AccessToken
from apps.workspaces.models import Workspace, Membership
from apps.workspaces.authentication import build_access_token

User = get_user_model()


@pytest.mark.django_db
def test_access_token_embeds_workspace_slug():
    u = User.objects.create_user(email='a@e', password='pw')
    ws = Workspace.objects.get(slug='idev')  # seeded by migration 0003
    Membership.objects.create(workspace=ws, user=u, role=Membership.Role.MEMBER)
    u.current_workspace = ws
    u.save()

    token_str = str(build_access_token(u))
    token = AccessToken(token_str)
    assert token['workspace_slug'] == 'idev'
    assert token['user_id'] == u.id


@pytest.mark.django_db
def test_access_token_without_current_workspace_has_null_claim():
    u = User.objects.create_user(email='b@e', password='pw')
    token = AccessToken(str(build_access_token(u)))
    assert token['workspace_slug'] is None
