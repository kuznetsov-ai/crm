import pytest
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership

User = get_user_model()


@pytest.mark.django_db
def test_idev_workspace_is_seeded_after_migrations():
    """The data migration must create a workspace with slug='idev'."""
    assert Workspace.objects.filter(slug='idev').exists()


@pytest.mark.django_db
def test_existing_user_gets_membership_and_current_workspace():
    idev = Workspace.objects.get(slug='idev')
    u = User.objects.create_user(email='legacy@idev.team', password='pw')
    Membership.objects.get_or_create(
        workspace=idev, user=u, defaults={'role': Membership.Role.MEMBER}
    )
    u.current_workspace = idev
    u.save(update_fields=['current_workspace'])

    assert Membership.objects.filter(workspace=idev, user=u).exists()
    assert u.current_workspace == idev
