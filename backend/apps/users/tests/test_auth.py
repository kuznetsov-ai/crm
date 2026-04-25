import pytest
from django.contrib.auth import get_user_model

User = get_user_model()

@pytest.mark.django_db
def test_create_user():
    user = User.objects.create_user(
        email='test@idev.team',
        password='testpass123',
        first_name='Test',
        last_name='User',
    )
    assert user.email == 'test@idev.team'
    assert user.check_password('testpass123')
    assert not user.is_staff

@pytest.mark.django_db
def test_create_superuser():
    user = User.objects.create_superuser(
        email='admin@idev.team',
        password='adminpass123',
    )
    assert user.is_staff
    assert user.is_superuser

@pytest.mark.django_db
def test_user_str():
    user = User.objects.create_user(
        email='john@idev.team',
        password='pass',
        first_name='John',
        last_name='Doe',
    )
    assert str(user) == 'John Doe'

@pytest.mark.django_db
def test_user_full_name():
    user = User.objects.create_user(
        email='jane@idev.team',
        password='pass',
        first_name='Jane',
        last_name='Smith',
    )
    assert user.full_name == 'Jane Smith'

@pytest.mark.django_db
def test_role_creation():
    from apps.users.models import Role
    role = Role.objects.create(
        name='Test Role',
        preset=Role.Preset.SALES_MANAGER,
        can_manage_deals=True,
        can_manage_clients=True,
    )
    assert str(role) == 'Test Role'
    assert role.can_manage_deals is True
    assert role.can_manage_users is False  # default

@pytest.mark.django_db
def test_employee_creation():
    from apps.users.models import Role, Employee
    role = Role.objects.create(name='Admin', preset=Role.Preset.ADMIN, can_manage_users=True)
    user = User.objects.create_user(email='emp@idev.team', password='pass', role=role)
    employee = Employee.objects.create(user=user, position='Developer', department='Engineering')
    assert str(employee) == f'{user} — Developer'
    assert employee.manager is None

@pytest.mark.django_db
def test_create_user_empty_email_raises():
    with pytest.raises(ValueError, match='Email is required'):
        User.objects.create_user(email='', password='pass')

@pytest.mark.django_db
def test_sales_plan_creation():
    from apps.users.models import Role, Employee, SalesPlan
    import datetime
    from decimal import Decimal
    role = Role.objects.create(name='SM', preset=Role.Preset.SALES_MANAGER)
    user = User.objects.create_user(email='sm@idev.team', password='pass', role=role)
    employee = Employee.objects.create(user=user, position='Sales')
    plan = SalesPlan.objects.create(
        employee=employee,
        period_start=datetime.date(2026, 1, 1),
        period_end=datetime.date(2026, 3, 31),
        target_amount_usd=Decimal('10000.00'),
        scope=SalesPlan.Scope.PERSONAL,
    )
    assert plan.target_amount_usd == Decimal('10000.00')
    assert plan.scope == SalesPlan.Scope.PERSONAL
    assert 'sm@idev.team' in str(plan)

@pytest.mark.django_db
def test_role_str_and_defaults():
    from apps.users.models import Role
    viewer = Role.objects.create(name='Viewer', preset=Role.Preset.VIEWER)
    assert str(viewer) == 'Viewer'
    # can_manage_users defaults to False; can_manage_deals defaults to True
    assert viewer.can_manage_users is False
    assert viewer.can_manage_deals is True   # default is True per model
    assert viewer.can_manage_settings is False


# ── API Tests ──────────────────────────────────────────────────────────────────

from rest_framework.test import APIClient
from apps.users.models import Role

@pytest.fixture
def api_client():
    return APIClient()

@pytest.fixture
def admin_role(db):
    return Role.objects.create(
        name='Admin',
        preset=Role.Preset.ADMIN,
        can_manage_users=True,
        can_manage_deals=True,
        can_manage_clients=True,
        can_view_reports=True,
        can_manage_settings=True,
    )

@pytest.fixture
def admin_user(db, admin_role):
    return User.objects.create_user(
        email='admin@idev.team',
        password='adminpass',
        first_name='Admin',
        last_name='User',
        role=admin_role,
    )

@pytest.mark.django_db
def test_login_success(api_client, admin_user):
    response = api_client.post('/api/token/', {
        'email': 'admin@idev.team',
        'password': 'adminpass',
    }, format='json')
    assert response.status_code == 200
    assert 'access' in response.data
    assert 'refresh' in response.data

@pytest.mark.django_db
def test_login_wrong_password(api_client, admin_user):
    response = api_client.post('/api/token/', {
        'email': 'admin@idev.team',
        'password': 'wrong',
    }, format='json')
    assert response.status_code == 401

@pytest.mark.django_db
def test_me_endpoint_returns_user_with_permissions(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get('/api/users/me/')
    assert response.status_code == 200
    assert response.data['email'] == 'admin@idev.team'
    assert 'role' in response.data
    assert 'permissions' in response.data
    assert response.data['permissions']['can_manage_users'] is True

@pytest.mark.django_db
def test_me_unauthenticated(api_client):
    response = api_client.get('/api/users/me/')
    assert response.status_code in (401, 403)

@pytest.mark.django_db
def test_user_list_requires_admin(api_client, admin_user):
    # Non-admin cannot access user list
    viewer_role = Role.objects.create(name='Viewer', preset=Role.Preset.VIEWER, can_manage_users=False)
    viewer = User.objects.create_user(email='viewer@idev.team', password='pass', role=viewer_role)
    api_client.force_authenticate(user=viewer)
    response = api_client.get('/api/users/')
    assert response.status_code == 403

@pytest.mark.django_db
def test_user_list_admin_can_access(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get('/api/users/')
    assert response.status_code == 200
    assert 'results' in response.data  # paginated

@pytest.mark.django_db
def test_roles_list(api_client, admin_user, admin_role):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get('/api/users/roles/')
    assert response.status_code == 200
    assert len(response.data) >= 1

@pytest.mark.django_db
def test_me_patch_updates_language(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.patch('/api/users/me/', {'language': 'en'}, format='json')
    assert response.status_code == 200
    assert response.data['language'] == 'en'

@pytest.mark.django_db
def test_user_detail_get(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get(f'/api/users/{admin_user.pk}/')
    assert response.status_code == 200
    assert response.data['email'] == 'admin@idev.team'

@pytest.mark.django_db
def test_user_detail_soft_delete(api_client, admin_user):
    # Create a second user to delete
    from apps.users.models import Role
    role = Role.objects.create(name='ToDelete', preset=Role.Preset.VIEWER)
    target = User.objects.create_user(email='delete@idev.team', password='pass', role=role)
    api_client.force_authenticate(user=admin_user)
    response = api_client.delete(f'/api/users/{target.pk}/')
    assert response.status_code == 204
    target.refresh_from_db()
    assert target.is_active is False
    # Should not appear in list
    list_resp = api_client.get('/api/users/')
    emails = [u['email'] for u in list_resp.data['results']]
    assert 'delete@idev.team' not in emails

@pytest.mark.django_db
def test_me_patch_cannot_change_role(api_client, admin_user):
    """Users cannot escalate their own role via PATCH /me/."""
    viewer_role = Role.objects.create(name='ViewerRole', preset=Role.Preset.VIEWER)
    api_client.force_authenticate(user=admin_user)
    response = api_client.patch('/api/users/me/', {'role_id': viewer_role.pk}, format='json')
    # role_id should be ignored — admin_user still has admin role
    assert response.status_code == 200
    admin_user.refresh_from_db()
    assert admin_user.role.name == 'Admin'  # unchanged
