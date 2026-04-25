from django.db import migrations, models
import django.db.models.deletion

AFFECTED_MODELS = ['Client', 'Contact', 'ClientDocument', 'ClientNote', 'RateCard', 'BenchPerson']


class Migration(migrations.Migration):
    dependencies = [('clients', '0010_backfill_workspace')]
    operations = [
        migrations.AlterField(
            model_name=name.lower(),
            name='workspace',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='+',
                to='workspaces.workspace',
            ),
        )
        for name in AFFECTED_MODELS
    ]
