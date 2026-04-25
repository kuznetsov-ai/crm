"""Tests for the Product catalog model, API, and DealItem.product FK."""
import pytest
from decimal import Decimal
from django.db import IntegrityError, transaction
from rest_framework.test import APIClient

from apps.workspaces.models import Workspace, Membership
from apps.products.models import Product
from django.contrib.auth import get_user_model

User = get_user_model()


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def workspace(db):
    ws, _ = Workspace.objects.get_or_create(slug='idev', defaults={'name': 'iDev', 'is_active': True})
    return ws


@pytest.fixture
def user(workspace):
    from apps.users.models import Role
    role, _ = Role.objects.get_or_create(
        name='prod_test_role',
        defaults={'preset': Role.Preset.SALES_MANAGER,
                  'can_manage_clients': True, 'can_manage_deals': True},
    )
    u, _ = User.objects.get_or_create(
        email='prod_test@idev.team',
        defaults={'first_name': 'Prod', 'last_name': 'Test', 'role': role},
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
def product(workspace):
    return Product.objects.create(
        workspace=workspace,
        name='Staff Augmentation',
        sku='STAFF-AUG-001',
        unit='мес',
        default_rate=Decimal('5000.00'),
        default_rate_type='monthly',
    )


# ── Model: __str__ and unique SKU constraint ──────────────────────────────────

@pytest.mark.django_db
def test_product_str(product):
    assert str(product) == 'Staff Augmentation'


@pytest.mark.django_db
def test_empty_sku_allows_multiple(workspace):
    """Multiple products with empty SKU must be allowed (constraint condition: sku__gt='')."""
    p1 = Product.objects.create(workspace=workspace, name='Alpha', sku='')
    p2 = Product.objects.create(workspace=workspace, name='Beta', sku='')
    assert p1.pk != p2.pk


@pytest.mark.django_db
def test_non_empty_sku_unique_per_workspace(workspace):
    """Two products with the same non-empty SKU in the same workspace must raise."""
    Product.objects.create(workspace=workspace, name='Alpha', sku='DUPE-SKU')
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Product.objects.create(workspace=workspace, name='Beta', sku='DUPE-SKU')


@pytest.mark.django_db
def test_same_sku_different_workspaces_ok():
    """The same SKU is allowed across different workspaces."""
    ws1, _ = Workspace.objects.get_or_create(slug='ws-sku-1', defaults={'name': 'WS SKU 1'})
    ws2, _ = Workspace.objects.get_or_create(slug='ws-sku-2', defaults={'name': 'WS SKU 2'})
    p1 = Product.objects.create(workspace=ws1, name='Alpha', sku='SHARED-SKU')
    p2 = Product.objects.create(workspace=ws2, name='Alpha', sku='SHARED-SKU')
    assert p1.pk != p2.pk


# ── DealItem can link to Product ──────────────────────────────────────────────

@pytest.mark.django_db
def test_dealitem_can_link_to_product(workspace, product):
    """DealItem.product FK is optional; when set it references the Product."""
    from apps.clients.models import Client
    from apps.deals.models import Deal, DealItem
    from apps.pipelines.models import Pipeline, Stage

    client = Client.objects.create(name='Prod client', workspace=workspace)
    pipeline, _ = Pipeline.objects.get_or_create(
        workspace=workspace, kind='deal', name='Prod pipeline',
        defaults={'is_default': False, 'order': 99},
    )
    stage, _ = Stage.objects.get_or_create(
        pipeline=pipeline, code='new',
        defaults={'name': 'New', 'order': 0},
    )
    deal = Deal.objects.create(
        title='Prod deal', client=client, workspace=workspace,
        pipeline=pipeline, stage=stage,
    )

    item = DealItem.objects.create(
        deal=deal,
        product=product,
        role=product.name,
        rate=Decimal(str(product.default_rate)),
        rate_type=product.default_rate_type,
        quantity=1,
        months=3,
    )
    item.refresh_from_db()
    assert item.product_id == product.pk
    assert item.subtotal == Decimal(str(product.default_rate)) * 3  # monthly × months


@pytest.mark.django_db
def test_dealitem_product_is_optional(workspace):
    """Existing DealItem creation without product must still work."""
    from apps.clients.models import Client
    from apps.deals.models import Deal, DealItem
    from apps.pipelines.models import Pipeline, Stage

    client = Client.objects.create(name='No-product client', workspace=workspace)
    pipeline, _ = Pipeline.objects.get_or_create(
        workspace=workspace, kind='deal', name='Prod pipeline no prod',
        defaults={'is_default': False, 'order': 98},
    )
    stage, _ = Stage.objects.get_or_create(
        pipeline=pipeline, code='new',
        defaults={'name': 'New', 'order': 0},
    )
    deal = Deal.objects.create(
        title='No-product deal', client=client, workspace=workspace,
        pipeline=pipeline, stage=stage,
    )
    item = DealItem.objects.create(
        deal=deal,
        role='Custom role',
        rate=Decimal('1000.00'),
        rate_type='fixed',
        quantity=2,
    )
    assert item.product_id is None


# ── API: workspace-scoped product list ────────────────────────────────────────

@pytest.mark.django_db
def test_products_list_api_scoped(api_client, workspace, product):
    """GET /api/products/ must return only products in the current workspace."""
    # Create a product in a separate workspace — must NOT appear.
    other_ws, _ = Workspace.objects.get_or_create(slug='other-ws', defaults={'name': 'Other'})
    Product.objects.create(workspace=other_ws, name='Other product', sku='OTHER-1')

    resp = api_client.get(
        '/api/products/',
        HTTP_X_WORKSPACE_SLUG='idev',
        SERVER_NAME='localhost',
    )
    assert resp.status_code == 200
    names = [p['name'] for p in resp.data['results']]
    assert product.name in names
    assert 'Other product' not in names


@pytest.mark.django_db
def test_products_create_api(api_client, workspace):
    """POST /api/products/ must create a product in the current workspace."""
    resp = api_client.post(
        '/api/products/',
        {
            'name': 'Dev ops service',
            'sku': 'DEVOPS-001',
            'unit': 'час',
            'default_rate': '75.00',
            'default_rate_type': 'hourly',
        },
        format='json',
        HTTP_X_WORKSPACE_SLUG='idev',
        SERVER_NAME='localhost',
    )
    assert resp.status_code == 201
    assert resp.data['name'] == 'Dev ops service'
    assert resp.data['workspace'] == workspace.pk
