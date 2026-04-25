import pytest
from apps.workspaces.models import Workspace
from apps.deals.models import Deal, DealNote, DealDocument
from apps.clients.models import Client


@pytest.mark.django_db
def test_workspace_fk_on_all_deal_models():
    for model in (Deal, DealNote, DealDocument):
        f = model._meta.get_field('workspace')
        assert not f.null
        assert f.remote_field.model.__name__ == 'Workspace'


@pytest.mark.django_db
def test_for_workspace_filters_deals():
    ws_a = Workspace.objects.get(slug='idev')
    ws_b = Workspace.objects.create(slug='b', name='B')
    ca = Client.objects.create(name='AClient', workspace=ws_a)
    cb = Client.objects.create(name='BClient', workspace=ws_b)
    Deal.objects.create(title='a-deal', client=ca, workspace=ws_a)
    Deal.objects.create(title='b-deal', client=cb, workspace=ws_b)
    assert list(Deal.objects.for_workspace(ws_a).values_list('title', flat=True)) == ['a-deal']
