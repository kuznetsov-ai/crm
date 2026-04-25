from django.db import migrations


def seed_default_workspace(apps, schema_editor):
    Workspace = apps.get_model('workspaces', 'Workspace')
    Membership = apps.get_model('workspaces', 'Membership')
    User = apps.get_model('users', 'User')

    ws, _ = Workspace.objects.get_or_create(
        slug='idev',
        defaults={'name': 'iDev', 'is_active': True, 'settings': {}},
    )
    for user in User.objects.all():
        role = 'admin' if user.is_staff else 'member'
        Membership.objects.get_or_create(
            workspace=ws, user=user, defaults={'role': role}
        )


def unseed(apps, schema_editor):
    Workspace = apps.get_model('workspaces', 'Workspace')
    Workspace.objects.filter(slug='idev').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('workspaces', '0002_membership'),
        ('users', '0002_alter_employee_options_alter_role_options_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_default_workspace, unseed),
    ]
