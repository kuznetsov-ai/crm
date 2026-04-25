from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0004_backfill_current_workspace'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='last_seen',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
