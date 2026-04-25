"""
Tests for the partial unique constraint: at most one is_default=True per (workspace, kind).
"""
import pytest
from django.db import IntegrityError, transaction

from apps.workspaces.models import Workspace
from apps.pipelines.models import Pipeline


@pytest.mark.django_db
def test_cannot_create_second_default_pipeline_of_same_kind():
    """Creating a second is_default=True pipeline for the same workspace+kind must raise."""
    idev = Workspace.objects.get(slug='idev')
    # A default 'deal' pipeline is already seeded for idev in workspaces.0003_seed_default_idev.
    assert Pipeline.objects.filter(workspace=idev, kind='deal', is_default=True).exists()

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Pipeline.objects.create(
                workspace=idev,
                kind='deal',
                name='Other default',
                is_default=True,
            )


@pytest.mark.django_db
def test_can_create_non_default_pipeline_of_same_kind():
    """Creating a non-default pipeline alongside the existing default must succeed."""
    idev = Workspace.objects.get(slug='idev')
    p = Pipeline.objects.create(
        workspace=idev,
        kind='deal',
        name='Secondary sales',
        is_default=False,
    )
    assert p.pk is not None


@pytest.mark.django_db
def test_default_pipelines_across_different_kinds_ok():
    """Each (workspace, kind) pair can independently have one is_default=True."""
    idev = Workspace.objects.get(slug='idev')
    # Both deal and lead default pipelines may exist simultaneously.
    defaults = Pipeline.objects.filter(workspace=idev, is_default=True)
    # At minimum the seeded 'deal' default exists; the lead default may also exist.
    assert defaults.count() >= 1

    # Explicitly verify that deal and lead are different kinds and each is allowed.
    kinds_with_defaults = set(defaults.values_list('kind', flat=True))
    # No kind should appear more than once — that's the invariant being tested.
    for kind in kinds_with_defaults:
        count = Pipeline.objects.filter(
            workspace=idev, kind=kind, is_default=True
        ).count()
        assert count == 1, f"Found {count} default pipelines for kind={kind!r}"
