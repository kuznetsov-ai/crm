"""Tests for DealItem model, signal-based auto-recalc, and API endpoints."""
import pytest
from decimal import Decimal
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.clients.models import Client
from apps.deals.models import Deal, DealItem
from apps.users.models import Role
from apps.workspaces.models import Workspace, Membership

User = get_user_model()


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def workspace(db):
    ws, _ = Workspace.objects.get_or_create(slug='idev', defaults={'name': 'iDev', 'is_active': True})
    return ws


@pytest.fixture
def manager(workspace):
    role, _ = Role.objects.get_or_create(name='SM_DI', defaults={'preset': Role.Preset.SALES_MANAGER,
                                                                   'can_manage_deals': True,
                                                                   'can_manage_clients': True})
    u, _ = User.objects.get_or_create(email='di_manager@idev.team', defaults={
        'first_name': 'Item', 'last_name': 'Manager', 'role': role,
    })
    u.set_password('pass')
    u.save(update_fields=['password'])
    Membership.objects.get_or_create(workspace=workspace, user=u, defaults={'role': Membership.Role.MEMBER})
    u.current_workspace = workspace
    u.save(update_fields=['current_workspace'])
    return u


@pytest.fixture
def client_obj(manager, workspace):
    return Client.objects.create(name='Items Client', assigned_to=manager, created_by=manager, workspace=workspace)


@pytest.fixture
def deal(manager, client_obj, workspace):
    return Deal.objects.create(
        title='Item Deal', client=client_obj,
        assigned_to=manager, created_by=manager,
        value_usd=0, workspace=workspace,
    )


@pytest.fixture
def api_client(manager):
    c = APIClient()
    c.force_authenticate(user=manager)
    return c


# ── Model tests ───────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_dealitem_monthly_subtotal(deal):
    item = DealItem.objects.create(
        deal=deal, role='Developer', rate=Decimal('5000'),
        rate_type=DealItem.RateType.MONTHLY, quantity=2, months=3,
    )
    assert item.subtotal == Decimal('30000')  # 5000 * 2 * 3


@pytest.mark.django_db
def test_dealitem_hourly_subtotal(deal):
    item = DealItem.objects.create(
        deal=deal, role='QA', rate=Decimal('25'),
        rate_type=DealItem.RateType.HOURLY, quantity=1, hours=160,
    )
    assert item.subtotal == Decimal('4000')  # 25 * 1 * 160


@pytest.mark.django_db
def test_dealitem_fixed_subtotal(deal):
    item = DealItem.objects.create(
        deal=deal, role='Setup', rate=Decimal('1000'),
        rate_type=DealItem.RateType.FIXED, quantity=1,
    )
    assert item.subtotal == Decimal('1000')  # 1000 * 1


@pytest.mark.django_db
def test_signal_recalculates_value_usd(deal):
    DealItem.objects.create(
        deal=deal, role='Dev', rate=Decimal('3000'),
        rate_type=DealItem.RateType.MONTHLY, quantity=1, months=2,
    )
    deal.refresh_from_db()
    assert deal.value_usd == Decimal('6000')

    DealItem.objects.create(
        deal=deal, role='QA', rate=Decimal('2000'),
        rate_type=DealItem.RateType.MONTHLY, quantity=1, months=2,
    )
    deal.refresh_from_db()
    assert deal.value_usd == Decimal('10000')


@pytest.mark.django_db
def test_signal_delete_recalculates(deal):
    item1 = DealItem.objects.create(
        deal=deal, role='Dev', rate=Decimal('3000'),
        rate_type=DealItem.RateType.MONTHLY, quantity=1, months=1,
    )
    DealItem.objects.create(
        deal=deal, role='QA', rate=Decimal('2000'),
        rate_type=DealItem.RateType.MONTHLY, quantity=1, months=1,
    )
    deal.refresh_from_db()
    assert deal.value_usd == Decimal('5000')

    item1.delete()
    deal.refresh_from_db()
    assert deal.value_usd == Decimal('2000')


@pytest.mark.django_db
def test_amount_override_bypasses_sum(deal):
    DealItem.objects.create(
        deal=deal, role='Dev', rate=Decimal('3000'),
        rate_type=DealItem.RateType.MONTHLY, quantity=1, months=1,
    )
    deal.amount_override = Decimal('99999')
    deal.save(update_fields=['amount_override'])
    assert deal.amount == Decimal('99999')


@pytest.mark.django_db
def test_amount_property_uses_value_usd_when_no_override(deal):
    DealItem.objects.create(
        deal=deal, role='Dev', rate=Decimal('1500'),
        rate_type=DealItem.RateType.MONTHLY, quantity=2, months=1,
    )
    deal.refresh_from_db()
    assert deal.amount_override is None
    assert deal.amount == Decimal('3000')


# ── API tests ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_api_list_items_empty(api_client, deal):
    r = api_client.get(f'/api/deals/{deal.pk}/items/')
    assert r.status_code == 200
    results = r.data if isinstance(r.data, list) else r.data.get('results', r.data)
    assert results == []


@pytest.mark.django_db
def test_api_create_item(api_client, deal):
    r = api_client.post(f'/api/deals/{deal.pk}/items/', {
        'role': 'Backend Dev',
        'rate': '4000.00',
        'rate_type': 'monthly',
        'quantity': 2,
        'months': 3,
    }, format='json')
    assert r.status_code == 201
    assert r.data['subtotal'] == '24000.00'
    deal.refresh_from_db()
    assert deal.value_usd == Decimal('24000')


@pytest.mark.django_db
def test_api_update_item(api_client, deal):
    item = DealItem.objects.create(
        deal=deal, role='Dev', rate=Decimal('3000'),
        rate_type=DealItem.RateType.MONTHLY, quantity=1, months=1,
    )
    r = api_client.patch(f'/api/deals/{deal.pk}/items/{item.pk}/', {
        'months': 2,
    }, format='json')
    assert r.status_code == 200
    assert r.data['subtotal'] == '6000.00'


@pytest.mark.django_db
def test_api_delete_item(api_client, deal):
    item = DealItem.objects.create(
        deal=deal, role='Dev', rate=Decimal('3000'),
        rate_type=DealItem.RateType.MONTHLY, quantity=1, months=1,
    )
    deal.refresh_from_db()
    assert deal.value_usd == Decimal('3000')

    r = api_client.delete(f'/api/deals/{deal.pk}/items/{item.pk}/')
    assert r.status_code == 204
    deal.refresh_from_db()
    assert deal.value_usd == Decimal('0')


@pytest.mark.django_db
def test_api_reorder_items(api_client, deal):
    i1 = DealItem.objects.create(deal=deal, role='A', rate=Decimal('1'), rate_type='monthly', quantity=1, months=1, order=0)
    i2 = DealItem.objects.create(deal=deal, role='B', rate=Decimal('1'), rate_type='monthly', quantity=1, months=1, order=1)
    r = api_client.post(f'/api/deals/{deal.pk}/items/reorder/', [i2.pk, i1.pk], format='json')
    assert r.status_code == 200
    i1.refresh_from_db()
    i2.refresh_from_db()
    assert i2.order == 0
    assert i1.order == 1


@pytest.mark.django_db
def test_deal_serializer_exposes_items(api_client, deal):
    DealItem.objects.create(
        deal=deal, role='PM', rate=Decimal('5000'),
        rate_type=DealItem.RateType.MONTHLY, quantity=1, months=2,
    )
    r = api_client.get(f'/api/deals/{deal.pk}/')
    assert r.status_code == 200
    assert 'items' in r.data
    assert 'items_subtotal' in r.data
    assert len(r.data['items']) == 1
    assert r.data['items_subtotal'] == '10000.00'
