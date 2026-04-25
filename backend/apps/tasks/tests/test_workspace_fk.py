import pytest
from apps.workspaces.models import Workspace
from apps.tasks.models import Task


@pytest.mark.django_db
def test_task_workspace_fk_not_null():
    f = Task._meta.get_field('workspace')
    assert not f.null


@pytest.mark.django_db
def test_for_workspace_filters_tasks():
    ws_a = Workspace.objects.get(slug='idev')
    ws_b = Workspace.objects.create(slug='b', name='B')
    Task.objects.create(title='a', workspace=ws_a)
    Task.objects.create(title='b', workspace=ws_b)
    assert list(Task.objects.for_workspace(ws_a).values_list('title', flat=True)) == ['a']
