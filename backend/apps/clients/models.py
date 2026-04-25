from django.db import models
from django.conf import settings
from apps.workspaces.managers import WorkspaceManager


class Client(models.Model):
    class Status(models.TextChoices):
        LEAD = 'lead', 'Лид'
        PROSPECT = 'prospect', 'Потенциальный'
        ACTIVE = 'active', 'Активный'
        PAUSED = 'paused', 'На паузе'
        CHURNED = 'churned', 'Потерян'

    class Size(models.TextChoices):
        SMALL = '1-10', '1–10'
        MEDIUM = '11-50', '11–50'
        LARGE = '51-200', '51–200'
        ENTERPRISE = '200+', '200+'

    class BudgetRange(models.TextChoices):
        SMALL = 'small', 'До $5К/мес'
        MEDIUM = 'medium', '$5К–$20К/мес'
        LARGE = 'large', '$20К–$100К/мес'
        ENTERPRISE = 'enterprise', '$100К+/мес'

    class RiskLevel(models.TextChoices):
        LOW = 'low', 'Низкий'
        MEDIUM = 'medium', 'Средний'
        HIGH = 'high', 'Высокий'
        CRITICAL = 'critical', 'Критический'

    name = models.CharField(max_length=255)
    industry = models.CharField(max_length=100, blank=True)
    website = models.URLField(blank=True)
    country = models.CharField(max_length=100, blank=True)
    company_size = models.CharField(max_length=10, choices=Size.choices, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.LEAD)
    tech_stack = models.JSONField(default=list, blank=True)
    budget_range = models.CharField(max_length=20, choices=BudgetRange.choices, blank=True)
    description = models.TextField(blank=True)

    # Legal identifiers
    tax_id = models.CharField(max_length=20, blank=True, help_text='ИНН / TIN (digits only; 10 for RU legal entity, 12 for RU IP)')
    tax_id_country = models.CharField(max_length=2, blank=True, default='', help_text='ISO-3166 alpha-2, e.g. RU')

    # Async data sync: enrichment + ЕГРЮЛ cached on the client row
    sync_status = models.CharField(
        max_length=20, default='',
        help_text='pending / in_progress / done / failed',
    )
    sync_error = models.TextField(blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    sync_data = models.JSONField(default=dict, blank=True,
        help_text='{enriched: {...}, egrul: {...}, financials: {...}, hh: {...}}')

    # Risk scoring (rule-based + manual override)
    risk_score = models.PositiveSmallIntegerField(default=0, help_text='0–100, higher = riskier')
    risk_level = models.CharField(max_length=10, choices=RiskLevel.choices, default=RiskLevel.LOW)
    risk_factors = models.JSONField(default=list, blank=True, help_text='[{code, weight, detail}] — explainability')
    risk_notes = models.CharField(max_length=500, blank=True)
    risk_overridden = models.BooleanField(default=False)
    risk_override_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='risk_overrides',
    )
    risk_override_at = models.DateTimeField(null=True, blank=True)

    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_clients'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_clients'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkspaceManager()

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = 'Client'
        verbose_name_plural = 'Clients'
        ordering = ['-created_at']
        constraints = [
            # Unique (country, tax_id) when tax_id is non-empty
            models.UniqueConstraint(
                fields=['tax_id_country', 'tax_id'],
                condition=~models.Q(tax_id=''),
                name='unique_tax_id_per_country',
            ),
        ]
        indexes = [
            models.Index(fields=['tax_id']),
            models.Index(fields=['risk_score']),
            models.Index(fields=['risk_level']),
        ]


class Contact(models.Model):
    class Language(models.TextChoices):
        RU = 'ru', 'Russian'
        EN = 'en', 'English'

    class Role(models.TextChoices):
        DECISION_MAKER = 'decision_maker', 'ЛПР'
        MANAGER = 'manager', 'Менеджер'
        SECRETARY = 'secretary', 'Секретарь'
        OTHER = 'other', 'Другое'

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='contacts')
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=30, blank=True)
    position = models.CharField(max_length=150, blank=True)
    linkedin = models.URLField(blank=True)
    is_primary = models.BooleanField(default=False)
    language_pref = models.CharField(max_length=2, choices=Language.choices, default=Language.EN)
    notes = models.TextField(blank=True)
    telegram = models.CharField(max_length=100, blank=True)
    whatsapp = models.CharField(max_length=30, blank=True)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.OTHER, blank=True)
    order = models.PositiveIntegerField(default=0)
    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = WorkspaceManager()

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()

    def __str__(self):
        return self.full_name or self.email

    class Meta:
        verbose_name = 'Contact'
        verbose_name_plural = 'Contacts'
        ordering = ['-is_primary', 'last_name', 'first_name']


class ClientDocument(models.Model):
    from django.conf import settings as _settings
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='documents')
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to='clients/documents/')
    size = models.PositiveBigIntegerField(default=0)
    uploaded_by = models.ForeignKey(_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, related_name='client_documents')
    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = WorkspaceManager()

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} ({self.client})'


class ClientNote(models.Model):
    class NoteKind(models.TextChoices):
        NOTE = 'note', 'Note'
        MEETING = 'meeting', 'Meeting'
        CALL = 'call', 'Call'
        TRANSCRIPT = 'transcript', 'Transcript'
        DECISION = 'decision', 'Decision'

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='notes')
    kind = models.CharField(max_length=20, choices=NoteKind.choices, default=NoteKind.NOTE)
    title = models.CharField(max_length=255, blank=True)
    body = models.TextField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='client_notes',
    )
    pinned = models.BooleanField(default=False)
    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkspaceManager()

    class Meta:
        ordering = ['-pinned', '-created_at']

    def __str__(self):
        return f'{self.kind} on {self.client}: {self.title[:40]}'


class RateCard(models.Model):
    class Role(models.TextChoices):
        BA = 'ba', 'Business Analyst'
        SA = 'sa', 'System Analyst'
        DEV_JUNIOR = 'dev_junior', 'Developer — Junior'
        DEV_MIDDLE = 'dev_middle', 'Developer — Middle'
        DEV_SENIOR = 'dev_senior', 'Developer — Senior'
        DEV_LEAD = 'dev_lead', 'Developer — Lead'
        QA = 'qa', 'QA Engineer'
        DEVOPS = 'devops', 'DevOps'
        PM = 'pm', 'Project Manager'
        OTHER = 'other', 'Other'

    class Unit(models.TextChoices):
        HOURLY = 'hourly', 'Per hour'
        MONTHLY = 'monthly', 'Per month'

    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='rate_cards')
    role = models.CharField(max_length=30, choices=Role.choices)
    role_custom = models.CharField(max_length=100, blank=True, help_text='Free-form role name when role=other')
    unit = models.CharField(max_length=10, choices=Unit.choices, default=Unit.MONTHLY)
    bill_rate_usd = models.DecimalField(max_digits=10, decimal_places=2, help_text='What we bill the client')
    cost_rate_usd = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text='Internal cost (consultant payroll + overhead)')
    notes = models.CharField(max_length=255, blank=True)
    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkspaceManager()

    class Meta:
        ordering = ['client', 'role']
        unique_together = ('client', 'role', 'role_custom', 'unit')

    @property
    def margin_usd(self) -> float:
        return float(self.bill_rate_usd) - float(self.cost_rate_usd)

    @property
    def margin_pct(self) -> float:
        bill = float(self.bill_rate_usd)
        if bill == 0:
            return 0
        return round((self.margin_usd / bill) * 100, 1)

    def __str__(self):
        return f'{self.client} — {self.get_role_display()} @ ${self.bill_rate_usd}/{self.unit}'


class BenchPerson(models.Model):
    """Consultants available on our bench. Imported from idev-hr `persons` (status=BENCH)."""

    class Stream(models.TextChoices):
        ANALYST = 'ANALYST', 'Analyst'
        JAVA = 'JAVA', 'Java'
        ONE_C = 'ONE_C', '1C'
        OTHER = 'OTHER', 'Other'

    class Grade(models.TextChoices):
        JUNIOR = 'JUNIOR', 'Junior'
        MIDDLE = 'MIDDLE', 'Middle'
        MIDDLE_PLUS = 'MIDDLE_PLUS', 'Middle+'
        SENIOR = 'SENIOR', 'Senior'

    external_id = models.CharField(max_length=64, unique=True, blank=True, default='', help_text='idev-hr persons.id')
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True, default='')
    email = models.EmailField(blank=True, default='')
    phone = models.CharField(max_length=50, blank=True, default='')
    tg_handle = models.CharField(max_length=100, blank=True, default='')
    stream = models.CharField(max_length=20, choices=Stream.choices, default=Stream.OTHER)
    grade = models.CharField(max_length=20, choices=Grade.choices, blank=True, default='')
    rate_usd = models.IntegerField(null=True, blank=True, help_text='Daily / hourly rate in USD')
    market_rate_usd = models.IntegerField(null=True, blank=True)
    skills = models.JSONField(default=list, blank=True)
    stack = models.JSONField(default=list, blank=True)
    experience_years = models.FloatField(null=True, blank=True)
    location = models.CharField(max_length=100, blank=True, default='')
    source = models.CharField(max_length=100, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    resume_url = models.URLField(blank=True, default='')
    is_available = models.BooleanField(default=True)
    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = WorkspaceManager()

    class Meta:
        ordering = ['last_name', 'first_name']

    @property
    def full_name(self) -> str:
        parts = [self.last_name, self.first_name, self.middle_name]
        return ' '.join(p for p in parts if p).strip()

    def __str__(self):
        return f'{self.full_name} — {self.get_stream_display()} {self.get_grade_display() or ""}'.strip()
