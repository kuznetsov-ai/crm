import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('chat', '0007_backfill_dm_channels'),
    ]

    operations = [
        migrations.AddField(
            model_name='chatchannel',
            name='updated_at',
            field=models.DateTimeField(auto_now=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
    ]
