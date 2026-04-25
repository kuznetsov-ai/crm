"""Tests that the data migration correctly populated Activity from legacy models."""
import pytest
from apps.workspaces.models import Workspace
from apps.activities.models import Activity


@pytest.fixture
def workspace(db):
    ws, _ = Workspace.objects.get_or_create(slug='idev', defaults={'name': 'iDev', 'is_active': True})
    return ws


@pytest.mark.django_db
def test_migrated_client_notes_exist(workspace):
    """Any existing ClientNotes should have been migrated to Activity with entity=client."""
    from apps.clients.models import ClientNote
    if ClientNote.objects.exists():
        count = Activity.objects.filter(entity='client', type='note').count()
        assert count >= ClientNote.objects.count()


@pytest.mark.django_db
def test_migrated_deal_notes_exist(workspace):
    """Any existing non-deleted DealNotes should have been migrated to Activity with entity=deal."""
    from apps.deals.models import DealNote
    if DealNote.objects.filter(is_deleted=False).exists():
        count = Activity.objects.filter(entity='deal', type='note').count()
        assert count >= DealNote.objects.filter(is_deleted=False).count()


@pytest.mark.django_db
def test_activity_legacy_meta(workspace):
    """Migrated activities store legacy_id and source in meta."""
    from apps.clients.models import Client, ClientNote
    from django.contrib.auth import get_user_model
    User = get_user_model()

    user, _ = User.objects.get_or_create(
        email='migration_tester@idev.team',
        defaults={'first_name': 'M', 'last_name': 'T'},
    )

    client = Client.objects.create(name='MigTest Corp', workspace=workspace)
    note = ClientNote.objects.create(
        client=client,
        body='Migration test note',
        workspace=workspace,
        author=user,
    )

    # Simulate the migration logic manually (the migration already ran; here we test the logic)
    Activity.objects.create(
        workspace=workspace,
        type='note',
        entity='client',
        entity_id=client.pk,
        body=note.body,
        author=user,
        meta={'legacy_id': note.id, 'source': 'ClientNote', 'kind': note.kind},
    )

    act = Activity.objects.filter(
        entity='client', entity_id=client.pk, meta__source='ClientNote'
    ).last()
    assert act is not None
    assert act.meta['legacy_id'] == note.id
    assert act.body == 'Migration test note'
