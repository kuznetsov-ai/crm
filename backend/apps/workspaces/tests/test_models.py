import pytest
from django.db import IntegrityError
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership

User = get_user_model()


@pytest.mark.django_db
class TestWorkspaceModel:
    def test_str_returns_name(self):
        ws = Workspace.objects.create(slug='acme', name='Acme Inc')
        assert str(ws) == 'Acme Inc'

    def test_slug_is_unique(self):
        Workspace.objects.create(slug='acme', name='Acme')
        with pytest.raises(IntegrityError):
            Workspace.objects.create(slug='acme', name='Duplicate')

    def test_subdomain_is_optional_and_unique(self):
        Workspace.objects.create(slug='a', name='A', subdomain='a')
        Workspace.objects.create(slug='b', name='B', subdomain=None)  # allowed
        with pytest.raises(IntegrityError):
            Workspace.objects.create(slug='c', name='C', subdomain='a')

    def test_settings_default_dict(self):
        ws = Workspace.objects.create(slug='z', name='Z')
        assert ws.settings == {}

    def test_is_active_default_true(self):
        ws = Workspace.objects.create(slug='x', name='X')
        assert ws.is_active is True


@pytest.mark.django_db
class TestMembershipModel:
    def _user(self, email='u@example.com'):
        return User.objects.create_user(email=email, password='pw')

    def test_unique_per_user_and_workspace(self):
        ws = Workspace.objects.create(slug='w', name='W')
        u = self._user()
        Membership.objects.create(workspace=ws, user=u, role=Membership.Role.MEMBER)
        with pytest.raises(IntegrityError):
            Membership.objects.create(workspace=ws, user=u, role=Membership.Role.ADMIN)

    def test_same_user_in_multiple_workspaces(self):
        u = self._user()
        ws1 = Workspace.objects.create(slug='a', name='A')
        ws2 = Workspace.objects.create(slug='b', name='B')
        Membership.objects.create(workspace=ws1, user=u, role=Membership.Role.OWNER)
        Membership.objects.create(workspace=ws2, user=u, role=Membership.Role.MEMBER)
        assert u.memberships.count() == 2

    def test_role_choices(self):
        ws = Workspace.objects.create(slug='x', name='X')
        u = self._user('a@x')
        m = Membership.objects.create(workspace=ws, user=u, role=Membership.Role.OWNER)
        assert m.get_role_display() == 'Owner'

    def test_cascade_on_workspace_delete(self):
        ws = Workspace.objects.create(slug='y', name='Y')
        u = self._user('b@x')
        Membership.objects.create(workspace=ws, user=u, role=Membership.Role.MEMBER)
        ws.delete()
        assert Membership.objects.count() == 0
