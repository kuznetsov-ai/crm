import pytest
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace

User = get_user_model()


@pytest.mark.django_db
def test_user_has_current_workspace_fk():
    ws = Workspace.objects.create(slug='w', name='W')
    u = User.objects.create_user(email='u@e.com', password='pw', current_workspace=ws)
    u.refresh_from_db()
    assert u.current_workspace == ws


@pytest.mark.django_db
def test_user_current_workspace_nullable():
    u = User.objects.create_user(email='u2@e.com', password='pw')
    assert u.current_workspace is None


@pytest.mark.django_db
def test_user_current_workspace_set_null_on_workspace_delete():
    ws = Workspace.objects.create(slug='x', name='X')
    u = User.objects.create_user(email='u3@e.com', password='pw', current_workspace=ws)
    ws.delete()
    u.refresh_from_db()
    assert u.current_workspace is None
