import pytest
from apps.workspaces.models import Workspace
from apps.webhooks.models import WebhookEndpoint, WebhookDelivery


@pytest.mark.django_db
def test_workspace_fk_not_null():
    for m in (WebhookEndpoint, WebhookDelivery):
        assert not m._meta.get_field('workspace').null


@pytest.mark.django_db
def test_for_workspace_filters():
    ws_a = Workspace.objects.get(slug='idev')
    ws_b = Workspace.objects.create(slug='wh-b', name='WhB')
    WebhookEndpoint.objects.create(name='ep-a', url='https://a.example.com', workspace=ws_a)
    WebhookEndpoint.objects.create(name='ep-b', url='https://b.example.com', workspace=ws_b)
    assert WebhookEndpoint.objects.for_workspace(ws_a).count() == 1
