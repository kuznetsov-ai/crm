import pytest
from apps.workspaces.models import Workspace
from apps.clients.models import Client, Contact, ClientDocument, ClientNote, RateCard, BenchPerson


@pytest.mark.django_db
def test_every_model_has_workspace_fk():
    for model in (Client, Contact, ClientDocument, ClientNote, RateCard, BenchPerson):
        field = model._meta.get_field('workspace')
        assert field.is_relation
        assert not field.null
        assert field.remote_field.model.__name__ == 'Workspace'


@pytest.mark.django_db
def test_client_create_with_workspace():
    ws = Workspace.objects.get(slug='idev')
    c = Client.objects.create(name='Acme', workspace=ws)
    assert c.workspace == ws


@pytest.mark.django_db
def test_for_workspace_manager_filters():
    ws_a = Workspace.objects.get(slug='idev')
    ws_b = Workspace.objects.create(slug='b', name='B')
    Client.objects.create(name='A-client', workspace=ws_a)
    Client.objects.create(name='B-client', workspace=ws_b)
    assert list(Client.objects.for_workspace(ws_a).values_list('name', flat=True)) == ['A-client']
