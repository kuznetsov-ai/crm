import pytest
from apps.workspaces.models import Workspace
from apps.chat.models import ChatChannel, ChatMessage, ChatReaction, ChatMention


@pytest.mark.django_db
def test_all_chat_models_have_workspace_fk():
    for m in (ChatChannel, ChatMessage, ChatReaction, ChatMention):
        assert not m._meta.get_field('workspace').null


@pytest.mark.django_db
def test_channel_for_workspace_filters():
    ws_a = Workspace.objects.get(slug='idev')
    ws_b = Workspace.objects.create(slug='b', name='B')
    ChatChannel.objects.create(name='a', workspace=ws_a)
    ChatChannel.objects.create(name='b', workspace=ws_b)
    assert list(ChatChannel.objects.for_workspace(ws_a).values_list('name', flat=True)) == ['a']
