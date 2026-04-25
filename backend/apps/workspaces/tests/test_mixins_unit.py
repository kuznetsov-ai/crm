import pytest
from unittest.mock import MagicMock
from apps.workspaces.mixins import WorkspaceScopedViewSetMixin


def test_get_queryset_filters_none_when_request_workspace_none():
    mixin = WorkspaceScopedViewSetMixin()
    mixin.queryset = MagicMock()
    mixin.request = MagicMock(workspace=None)
    mixin.queryset.none.return_value = 'none-qs'
    assert mixin.get_queryset() == 'none-qs'


def test_get_queryset_delegates_to_for_workspace():
    mixin = WorkspaceScopedViewSetMixin()
    qs = MagicMock()
    qs.all.return_value = qs
    qs.for_workspace.return_value = 'filtered-qs'
    mixin.queryset = qs
    mixin.request = MagicMock(workspace='ws')
    assert mixin.get_queryset() == 'filtered-qs'
    qs.for_workspace.assert_called_once_with('ws')
