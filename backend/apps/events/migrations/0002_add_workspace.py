import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0001_initial'),
        ('workspaces', '0003_seed_default_idev'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='workspace',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='+', to='workspaces.workspace'),
        ),
    ]
