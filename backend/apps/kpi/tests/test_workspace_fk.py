import pytest
from apps.workspaces.models import Workspace
from apps.kpi.models import KPITarget


@pytest.mark.django_db
def test_workspace_fk_not_null():
    for m in (KPITarget,):
        assert not m._meta.get_field('workspace').null


@pytest.mark.django_db
def test_for_workspace_filters():
    ws_a = Workspace.objects.get(slug='idev')
    ws_b = Workspace.objects.create(slug='kpi-b', name='KpiB')
    KPITarget.objects.create(
        metric='deals_count', period='month', year=2026,
        period_number=1, target_value='10.00', workspace=ws_a,
    )
    KPITarget.objects.create(
        metric='revenue_usd', period='month', year=2026,
        period_number=1, target_value='5000.00', workspace=ws_b,
    )
    assert KPITarget.objects.for_workspace(ws_a).count() == 1
