import pytest
from apps.workspaces.models import Workspace
from apps.clients.models import Client
from apps.deals.models import Deal
from apps.dictionaries.models import Source, LostReason


@pytest.fixture
def idev(db):
    return Workspace.objects.get(slug='idev')


@pytest.mark.django_db
def test_deal_has_source_and_lost_reason_fields(idev):
    c = Client.objects.create(name='C', workspace=idev)
    src = Source.objects.get(workspace=idev, code='ads')
    reason = LostReason.objects.get(workspace=idev, code='no_budget')
    d = Deal.objects.create(
        title='T', client=c, workspace=idev,
        source=src, lost_reason=reason, lost_comment='nope',
    )
    d.refresh_from_db()
    assert d.source == src
    assert d.lost_reason == reason
    assert d.lost_comment == 'nope'
