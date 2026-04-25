from django.db import migrations


def migrate_forward(apps, schema_editor):
    Activity = apps.get_model('activities', 'Activity')
    ClientNote = apps.get_model('clients', 'ClientNote')
    DealNote = apps.get_model('deals', 'DealNote')

    # ClientNote -> Activity(type='note', entity='client')
    # ClientNote fields: id, client, kind, title, body, author, pinned, workspace, created_at, updated_at
    for n in ClientNote.objects.all().iterator():
        act = Activity(
            workspace_id=n.workspace_id,
            type='note',
            entity='client',
            entity_id=n.client_id,
            subject=n.title or '',
            body=n.body or '',
            author_id=n.author_id,
            is_pinned=n.pinned,
            meta={'legacy_id': n.id, 'source': 'ClientNote', 'kind': n.kind},
        )
        act.save()
        # Preserve original created_at using update to bypass auto_now_add
        Activity.objects.filter(pk=act.pk).update(created_at=n.created_at)

    # DealNote -> Activity(type='note', entity='deal')
    # DealNote fields: id, deal, author, text, is_deleted, workspace, created_at, updated_at
    for n in DealNote.objects.filter(is_deleted=False).iterator():
        act = Activity(
            workspace_id=n.workspace_id,
            type='note',
            entity='deal',
            entity_id=n.deal_id,
            body=n.text or '',
            author_id=n.author_id,
            meta={'legacy_id': n.id, 'source': 'DealNote'},
        )
        act.save()
        Activity.objects.filter(pk=act.pk).update(created_at=n.created_at)

    # DealTask — does not exist in this codebase, skip gracefully
    try:
        DealTask = apps.get_model('deals', 'DealTask')
        for t in DealTask.objects.all().iterator():
            act = Activity(
                workspace_id=getattr(t, 'workspace_id', None) or t.deal.workspace_id,
                type='task',
                entity='deal',
                entity_id=t.deal_id,
                subject=getattr(t, 'title', '') or '',
                body=getattr(t, 'description', '') or '',
                due_at=getattr(t, 'due_at', None),
                completed_at=getattr(t, 'completed_at', None),
                author_id=getattr(t, 'author_id', None),
                meta={'legacy_id': t.id, 'source': 'DealTask'},
            )
            act.save()
            if hasattr(t, 'created_at') and t.created_at:
                Activity.objects.filter(pk=act.pk).update(created_at=t.created_at)
    except LookupError:
        pass


def migrate_backward(apps, schema_editor):
    Activity = apps.get_model('activities', 'Activity')
    Activity.objects.filter(meta__has_key='legacy_id').delete()


class Migration(migrations.Migration):
    dependencies = [
        ('activities', '0001_initial'),
        ('clients', '0011_workspace_not_null'),
        ('deals', '0008_add_source_lost_reason'),
    ]
    operations = [migrations.RunPython(migrate_forward, migrate_backward)]
