from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('chat', '0008_add_channel_updated_at'),
        ('workspaces', '0004_currency_rate'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='chatmessage',
            name='forwarded_from',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=models.deletion.SET_NULL,
                related_name='forwards',
                to='chat.chatmessage',
            ),
        ),
        migrations.CreateModel(
            name='ChatMessageRead',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('read_at', models.DateTimeField(auto_now_add=True)),
                ('message', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='reads', to='chat.chatmessage')),
                ('user', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='message_reads', to=settings.AUTH_USER_MODEL)),
                ('workspace', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='+', to='workspaces.workspace')),
            ],
            options={
                'ordering': ['-read_at'],
            },
        ),
        migrations.AddIndex(
            model_name='chatmessageread',
            index=models.Index(fields=['user', 'message'], name='chat_chatme_user_id_msg_idx'),
        ),
        migrations.AddIndex(
            model_name='chatmessageread',
            index=models.Index(fields=['message', 'read_at'], name='chat_chatme_msg_id_read_idx'),
        ),
        migrations.AddConstraint(
            model_name='chatmessageread',
            constraint=models.UniqueConstraint(fields=('message', 'user'), name='chat_chatmessageread_unique'),
        ),
    ]
