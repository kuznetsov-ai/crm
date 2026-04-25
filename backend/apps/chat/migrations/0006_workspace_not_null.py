import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('chat', '0005_backfill_workspace'),
        ('workspaces', '0003_seed_default_idev'),
    ]

    operations = [
        migrations.AlterField(
            model_name='chatchannel',
            name='workspace',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='+', to='workspaces.workspace'),
        ),
        migrations.AlterField(
            model_name='chatmention',
            name='workspace',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='+', to='workspaces.workspace'),
        ),
        migrations.AlterField(
            model_name='chatmessage',
            name='workspace',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='+', to='workspaces.workspace'),
        ),
        migrations.AlterField(
            model_name='chatreaction',
            name='workspace',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='+', to='workspaces.workspace'),
        ),
    ]
