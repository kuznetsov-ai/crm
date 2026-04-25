import pytest
from django.db import IntegrityError
from apps.workspaces.models import Workspace
from apps.dictionaries.models import Source, LostReason


@pytest.fixture
def ws(db):
    return Workspace.objects.get(slug='idev')


@pytest.mark.django_db
def test_source_str_and_unique(ws):
    s = Source.objects.create(workspace=ws, code='unique_test_src', name='Test Source')
    assert str(s) == 'Test Source'
    with pytest.raises(IntegrityError):
        Source.objects.create(workspace=ws, code='unique_test_src', name='Dup')


@pytest.mark.django_db
def test_lost_reason_str_and_unique(ws):
    r = LostReason.objects.create(workspace=ws, code='unique_test_reason', name='No budget')
    assert str(r) == 'No budget'
    with pytest.raises(IntegrityError):
        LostReason.objects.create(workspace=ws, code='unique_test_reason', name='Dup')


@pytest.mark.django_db
def test_ordering(ws):
    Source.objects.create(workspace=ws, code='test_z', name='ZZZ', order=200)
    Source.objects.create(workspace=ws, code='test_a', name='AAA', order=100)
    codes = [s.code for s in Source.objects.filter(workspace=ws, code__startswith='test_').order_by('order')]
    assert codes == ['test_a', 'test_z']
