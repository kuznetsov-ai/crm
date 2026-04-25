from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


class Role(models.Model):
    class Preset(models.TextChoices):
        ADMIN = 'admin', 'Admin'
        SALES_MANAGER = 'sales_manager', 'Sales Manager'
        RECRUITER = 'recruiter', 'Recruiter'
        VIEWER = 'viewer', 'Viewer'

    name = models.CharField(max_length=50, unique=True)
    preset = models.CharField(max_length=30, choices=Preset.choices, default=Preset.VIEWER)
    can_manage_users = models.BooleanField(default=False)
    can_manage_deals = models.BooleanField(default=True)
    can_manage_clients = models.BooleanField(default=True)
    can_view_reports = models.BooleanField(default=False)
    can_manage_settings = models.BooleanField(default=False)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = 'Role'
        verbose_name_plural = 'Roles'
        ordering = ['name']


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Language(models.TextChoices):
        RU = 'ru', 'Russian'
        EN = 'en', 'English'

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.RU)
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)
    current_workspace = models.ForeignKey(
        'workspaces.Workspace',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='current_users',
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return f'{self.first_name} {self.last_name}'.strip() or self.email

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()

    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'


class Employee(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='employee')
    position = models.CharField(max_length=150, blank=True)
    department = models.CharField(max_length=150, blank=True)
    manager = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subordinates'
    )

    def __str__(self):
        return f'{self.user} — {self.position}'

    class Meta:
        verbose_name = 'Employee'
        verbose_name_plural = 'Employees'
        ordering = ['user__last_name', 'user__first_name']


class SalesPlan(models.Model):
    class Scope(models.TextChoices):
        PERSONAL = 'personal', 'Personal'
        DEPARTMENT = 'department', 'Department'
        COMPANY = 'company', 'Company'

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='sales_plans')
    period_start = models.DateField()
    period_end = models.DateField()
    target_amount_usd = models.DecimalField(max_digits=12, decimal_places=2)
    scope = models.CharField(max_length=20, choices=Scope.choices, default=Scope.PERSONAL)

    def __str__(self):
        return f'{self.employee} plan {self.period_start}–{self.period_end}'

    class Meta:
        verbose_name = 'Sales Plan'
        verbose_name_plural = 'Sales Plans'
        ordering = ['-period_start']
