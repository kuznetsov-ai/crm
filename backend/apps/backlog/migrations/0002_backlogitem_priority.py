from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('backlog', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='backlogitem',
            name='priority',
            field=models.CharField(
                choices=[('low', 'Low'), ('medium', 'Medium'), ('high', 'High')],
                default='medium',
                max_length=10,
            ),
        ),
    ]
