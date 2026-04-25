import pytest
from apps.workspaces.models import Workspace
from apps.workspaces.managers import WorkspaceManager, WorkspaceQuerySet


@pytest.mark.django_db
def test_for_workspace_filters_querysets():
    ws = Workspace.objects.create(slug='a', name='A')
    qs = WorkspaceQuerySet(model=Workspace).all()
    assert hasattr(qs, 'for_workspace')


def test_manager_inherits_queryset_methods():
    assert hasattr(WorkspaceManager, 'for_workspace')
