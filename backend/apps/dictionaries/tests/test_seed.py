import pytest
from apps.workspaces.models import Workspace
from apps.dictionaries.models import Source, LostReason


@pytest.mark.django_db
def test_sources_seeded():
    idev = Workspace.objects.get(slug='idev')
    codes = set(Source.objects.filter(workspace=idev).values_list('code', flat=True))
    assert codes >= {'ads', 'referral', 'cold_call', 'partner', 'website'}


@pytest.mark.django_db
def test_lost_reasons_seeded():
    idev = Workspace.objects.get(slug='idev')
    codes = set(LostReason.objects.filter(workspace=idev).values_list('code', flat=True))
    assert codes >= {'no_budget', 'competitor', 'not_relevant', 'no_contact', 'other'}
