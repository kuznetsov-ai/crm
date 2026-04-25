from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0007_client_last_synced_at_client_sync_data_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='BenchPerson',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('external_id', models.CharField(blank=True, default='', help_text='idev-hr persons.id', max_length=64, unique=True)),
                ('first_name', models.CharField(max_length=100)),
                ('last_name', models.CharField(max_length=100)),
                ('middle_name', models.CharField(blank=True, default='', max_length=100)),
                ('email', models.EmailField(blank=True, default='', max_length=254)),
                ('phone', models.CharField(blank=True, default='', max_length=50)),
                ('tg_handle', models.CharField(blank=True, default='', max_length=100)),
                ('stream', models.CharField(choices=[('ANALYST', 'Analyst'), ('JAVA', 'Java'), ('ONE_C', '1C'), ('OTHER', 'Other')], default='OTHER', max_length=20)),
                ('grade', models.CharField(blank=True, choices=[('JUNIOR', 'Junior'), ('MIDDLE', 'Middle'), ('MIDDLE_PLUS', 'Middle+'), ('SENIOR', 'Senior')], default='', max_length=20)),
                ('rate_usd', models.IntegerField(blank=True, help_text='Daily / hourly rate in USD', null=True)),
                ('market_rate_usd', models.IntegerField(blank=True, null=True)),
                ('skills', models.JSONField(blank=True, default=list)),
                ('stack', models.JSONField(blank=True, default=list)),
                ('experience_years', models.FloatField(blank=True, null=True)),
                ('location', models.CharField(blank=True, default='', max_length=100)),
                ('source', models.CharField(blank=True, default='', max_length=100)),
                ('notes', models.TextField(blank=True, default='')),
                ('resume_url', models.URLField(blank=True, default='')),
                ('is_available', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['last_name', 'first_name'],
            },
        ),
    ]
