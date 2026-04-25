import pytest
from apps.workspaces.models import Workspace
from apps.favorites.models import Favorite


@pytest.mark.django_db
def test_workspace_fk_not_null():
    for m in (Favorite,):
        assert not m._meta.get_field('workspace').null


@pytest.mark.django_db
def test_for_workspace_filters():
    from django.contrib.auth import get_user_model
    from apps.users.models import Role
    User = get_user_model()
    ws_a = Workspace.objects.get(slug='idev')
    ws_b = Workspace.objects.create(slug='fav-b', name='FavB')
    r = Role.objects.create(name='FAV', preset=Role.Preset.SALES_MANAGER)
    user = User.objects.create_user(email='fav@idev.team', password='pass', role=r)
    Favorite.objects.create(user=user, entity_type='client', entity_id=1, workspace=ws_a)
    Favorite.objects.create(user=user, entity_type='deal', entity_id=2, workspace=ws_b)
    assert Favorite.objects.for_workspace(ws_a).count() == 1
