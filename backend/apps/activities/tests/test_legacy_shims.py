"""Tests for the legacy /notes/ endpoints dual-write shim."""
import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from apps.workspaces.models import Workspace, Membership
from apps.users.models import Role
from apps.clients.models import Client, ClientNote
from apps.deals.models import Deal, DealNote
from apps.activities.models import Activity

User = get_user_model()


@pytest.fixture
def workspace(db):
    ws, _ = Workspace.objects.get_or_create(slug='idev', defaults={'name': 'iDev', 'is_active': True})
    return ws


@pytest.fixture
def user(workspace):
    role, _ = Role.objects.get_or_create(
        name='SM_shim',
        defaults={'preset': Role.Preset.SALES_MANAGER,
                  'can_manage_clients': True, 'can_manage_deals': True},
    )
    u, _ = User.objects.get_or_create(
        email='shim_user@idev.team',
        defaults={'first_name': 'Shim', 'last_name': 'User', 'role': role},
    )
    Membership.objects.get_or_create(workspace=workspace, user=u,
                                      defaults={'role': Membership.Role.MEMBER})
    u.current_workspace = workspace
    u.save(update_fields=['current_workspace'])
    return u


@pytest.fixture
def api_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def client_obj(workspace, user):
    return Client.objects.create(name='Shim Corp', workspace=workspace)


@pytest.fixture
def deal(workspace, client_obj):
    from apps.pipelines.models import Pipeline, Stage
    p, _ = Pipeline.objects.get_or_create(
        workspace=workspace, kind='deal', name='Shim Pipeline',
        defaults={'is_default': False, 'order': 99},
    )
    s, _ = Stage.objects.get_or_create(
        pipeline=p, code='new',
        defaults={'name': 'New', 'order': 0},
    )
    return Deal.objects.create(
        title='Shim Deal', client=client_obj, workspace=workspace,
        pipeline=p, stage=s,
    )


# ── ClientNote ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_client_note_post_creates_legacy_row(api_client, client_obj):
    before = ClientNote.objects.filter(client=client_obj).count()
    resp = api_client.post(
        f'/api/clients/{client_obj.pk}/notes/',
        {'body': 'Dual-write test', 'kind': 'note'},
        format='json',
        HTTP_X_WORKSPACE_SLUG='idev',
    )
    assert resp.status_code == 201
    assert ClientNote.objects.filter(client=client_obj).count() == before + 1


@pytest.mark.django_db
def test_client_note_post_creates_activity(api_client, workspace, client_obj):
    before = Activity.objects.filter(entity='client', entity_id=client_obj.pk, type='note').count()
    resp = api_client.post(
        f'/api/clients/{client_obj.pk}/notes/',
        {'body': 'Activity dual-write', 'kind': 'note'},
        format='json',
        HTTP_X_WORKSPACE_SLUG='idev',
    )
    assert resp.status_code == 201
    after = Activity.objects.filter(entity='client', entity_id=client_obj.pk, type='note').count()
    assert after == before + 1


@pytest.mark.django_db
def test_client_note_list_returns_deprecation_header(api_client, client_obj):
    resp = api_client.get(
        f'/api/clients/{client_obj.pk}/notes/',
        HTTP_X_WORKSPACE_SLUG='idev',
    )
    assert resp.status_code == 200
    assert 'X-Deprecation' in resp


# ── DealNote ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_deal_note_post_creates_legacy_row(api_client, deal):
    before = DealNote.objects.filter(deal=deal).count()
    resp = api_client.post(
        f'/api/deals/{deal.pk}/notes/',
        {'text': 'Deal dual-write'},
        format='json',
        HTTP_X_WORKSPACE_SLUG='idev',
    )
    assert resp.status_code == 201
    assert DealNote.objects.filter(deal=deal).count() == before + 1


@pytest.mark.django_db
def test_deal_note_post_creates_activity(api_client, workspace, deal):
    before = Activity.objects.filter(entity='deal', entity_id=deal.pk, type='note').count()
    resp = api_client.post(
        f'/api/deals/{deal.pk}/notes/',
        {'text': 'Deal activity dual-write'},
        format='json',
        HTTP_X_WORKSPACE_SLUG='idev',
    )
    assert resp.status_code == 201
    after = Activity.objects.filter(entity='deal', entity_id=deal.pk, type='note').count()
    assert after == before + 1


@pytest.mark.django_db
def test_deal_note_list_returns_deprecation_header(api_client, deal):
    resp = api_client.get(
        f'/api/deals/{deal.pk}/notes/',
        HTTP_X_WORKSPACE_SLUG='idev',
    )
    assert resp.status_code == 200
    assert 'X-Deprecation' in resp
