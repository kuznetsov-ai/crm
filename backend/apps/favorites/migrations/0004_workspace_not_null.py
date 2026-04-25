from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [('favorites', '0003_backfill_workspace')]
    operations = [
        migrations.AlterField(
            model_name='favorite',
            name='workspace',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='+',
                to='workspaces.workspace',
            ),
        ),
    ]
