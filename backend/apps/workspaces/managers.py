from django.db import models


class WorkspaceQuerySet(models.QuerySet):
    """Chainable filter: `.for_workspace(ws)` returns rows for that workspace."""

    def for_workspace(self, workspace):
        if workspace is None:
            return self.none()
        return self.filter(workspace=workspace)


class WorkspaceManager(models.Manager.from_queryset(WorkspaceQuerySet)):
    pass
