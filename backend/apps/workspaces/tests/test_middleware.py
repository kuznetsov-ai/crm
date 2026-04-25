import pytest
from django.http import HttpRequest, HttpResponse
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership
from apps.workspaces.middleware import WorkspaceMiddleware

User = get_user_model()


def _req(user=None, header=None):
    req = HttpRequest()
    req.method = 'GET'
    req.path = '/'
    req.user = user if user is not None else type('Anon', (), {'is_authenticated': False})()
    if header:
        req.META['HTTP_X_WORKSPACE_SLUG'] = header
    return req


def _mw():
    return WorkspaceMiddleware(get_response=lambda r: HttpResponse('ok'))


@pytest.mark.django_db
def test_header_wins_when_member():
    u = User.objects.create_user(email='a@x', password='pw')
    ws = Workspace.objects.create(slug='a', name='A')
    Membership.objects.create(workspace=ws, user=u, role=Membership.Role.MEMBER)
    req = _req(user=u, header='a')
    _mw()(req)
    assert req.workspace == ws


@pytest.mark.django_db
def test_header_rejected_when_not_member():
    u = User.objects.create_user(email='b@x', password='pw')
    Workspace.objects.create(slug='a', name='A')  # user is NOT a member
    req = _req(user=u, header='a')
    _mw()(req)
    assert req.workspace is None


@pytest.mark.django_db
def test_falls_back_to_current_workspace():
    u = User.objects.create_user(email='c@x', password='pw')
    ws = Workspace.objects.create(slug='b', name='B')
    Membership.objects.create(workspace=ws, user=u, role=Membership.Role.MEMBER)
    u.current_workspace = ws
    u.save(update_fields=['current_workspace'])
    req = _req(user=u, header=None)
    _mw()(req)
    assert req.workspace == ws


@pytest.mark.django_db
def test_anonymous_user_gets_none():
    req = _req(user=None, header='anything')
    _mw()(req)
    assert req.workspace is None
