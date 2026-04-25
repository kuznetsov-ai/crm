from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('events', '0003_backfill_workspace')]
    operations = [
        migrations.AlterField(
            model_name='event',
            name='workspace',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='+',
                to='workspaces.workspace',
            ),
        ),
    ]
