import pytest
from apps.workspaces.models import Workspace
from apps.backlog.models import BacklogItem, BacklogComment


@pytest.mark.django_db
def test_workspace_fk_not_null():
    for m in (BacklogItem, BacklogComment):
        assert not m._meta.get_field('workspace').null


@pytest.mark.django_db
def test_for_workspace_filters():
    ws_a = Workspace.objects.get(slug='idev')
    ws_b = Workspace.objects.create(slug='b', name='B')
    BacklogItem.objects.create(title='a', workspace=ws_a)
    BacklogItem.objects.create(title='b', workspace=ws_b)
    assert list(BacklogItem.objects.for_workspace(ws_a).values_list('title', flat=True)) == ['a']
