from django.db import models
from django.conf import settings
from apps.workspaces.managers import WorkspaceManager


class KPITarget(models.Model):
    METRIC_CHOICES = [
        ('deals_count', 'Количество сделок'),
        ('revenue_usd', 'Выручка USD'),
        ('new_leads', 'Новые лиды'),
        ('tasks_done', 'Задачи выполнены'),
        ('clients_added', 'Новые клиенты'),
    ]
    PERIOD_CHOICES = [
        ('day', 'День'),
        ('week', 'Неделя'),
        ('month', 'Месяц'),
        ('quarter', 'Квартал'),
        ('year', 'Год'),
    ]

    objects = WorkspaceManager()

    workspace = models.ForeignKey(
        'workspaces.Workspace',
        on_delete=models.CASCADE,
        related_name='+',
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='kpi_targets',
    )  # null = company or department level
    department = models.CharField(max_length=150, blank=True, null=True)
    # null assigned_to + null department = company level
    # null assigned_to + department     = department level
    # assigned_to set                   = individual level
    metric = models.CharField(max_length=30, choices=METRIC_CHOICES)
    period = models.CharField(max_length=10, choices=PERIOD_CHOICES)
    year = models.PositiveIntegerField()
    period_number = models.PositiveIntegerField()  # month:1-12, quarter:1-4, week:1-53, day:1-366, year:1
    target_value = models.DecimalField(max_digits=14, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['assigned_to', 'department', 'metric', 'period', 'year', 'period_number']
        verbose_name = 'KPI Target'
        verbose_name_plural = 'KPI Targets'
        ordering = ['-year', '-period_number', 'metric']

    def __str__(self):
        user = self.assigned_to.email if self.assigned_to else 'Company'
        return f'{user} — {self.metric} ({self.period} {self.period_number}/{self.year})'
