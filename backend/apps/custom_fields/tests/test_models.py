import pytest
from django.db import IntegrityError
from apps.workspaces.models import Workspace
from apps.custom_fields.models import CustomFieldDef, CustomFieldValue, Entity, FieldType


@pytest.fixture
def ws(db):
    return Workspace.objects.get(slug='idev')


@pytest.mark.django_db
def test_custom_field_def_str(ws):
    f = CustomFieldDef.objects.create(
        workspace=ws, entity=Entity.DEAL, code='inn', label='ИНН', type=FieldType.STRING
    )
    assert str(f) == 'deal.inn (ИНН)'


@pytest.mark.django_db
def test_custom_field_def_unique_together(ws):
    CustomFieldDef.objects.create(
        workspace=ws, entity=Entity.DEAL, code='inn', label='ИНН', type=FieldType.STRING
    )
    with pytest.raises(IntegrityError):
        CustomFieldDef.objects.create(
            workspace=ws, entity=Entity.DEAL, code='inn', label='Dup', type=FieldType.STRING
        )


@pytest.mark.django_db
def test_custom_field_def_same_code_different_entity(ws):
    f1 = CustomFieldDef.objects.create(
        workspace=ws, entity=Entity.DEAL, code='inn', label='ИНН deal', type=FieldType.STRING
    )
    f2 = CustomFieldDef.objects.create(
        workspace=ws, entity=Entity.CLIENT, code='inn', label='ИНН client', type=FieldType.STRING
    )
    assert f1.pk != f2.pk


@pytest.mark.django_db
def test_custom_field_value_unique_together(ws):
    f = CustomFieldDef.objects.create(
        workspace=ws, entity=Entity.DEAL, code='val_code', label='Val', type=FieldType.STRING
    )
    CustomFieldValue.objects.create(
        workspace=ws, field=f, entity=Entity.DEAL, entity_id=1, value_text='hello'
    )
    with pytest.raises(IntegrityError):
        CustomFieldValue.objects.create(
            workspace=ws, field=f, entity=Entity.DEAL, entity_id=1, value_text='world'
        )


@pytest.mark.django_db
def test_custom_field_value_str(ws):
    f = CustomFieldDef.objects.create(
        workspace=ws, entity=Entity.DEAL, code='x', label='X', type=FieldType.STRING
    )
    v = CustomFieldValue.objects.create(
        workspace=ws, field=f, entity=Entity.DEAL, entity_id=99, value_text='abc'
    )
    assert 'CustomFieldValue' in str(v)


@pytest.mark.django_db
def test_custom_field_def_options_default(ws):
    f = CustomFieldDef.objects.create(
        workspace=ws, entity=Entity.LEAD, code='priority', label='Priority',
        type=FieldType.ENUM,
        options=[{'code': 'high', 'label': 'High'}, {'code': 'low', 'label': 'Low'}],
    )
    assert f.options[0]['code'] == 'high'


@pytest.mark.django_db
def test_custom_field_def_ordering(ws):
    CustomFieldDef.objects.create(
        workspace=ws, entity=Entity.DEAL, code='zzz', label='ZZZ', order=200
    )
    CustomFieldDef.objects.create(
        workspace=ws, entity=Entity.DEAL, code='aaa', label='AAA', order=100
    )
    codes = [f.code for f in CustomFieldDef.objects.filter(
        workspace=ws, entity=Entity.DEAL, code__in=['zzz', 'aaa']
    ).order_by('order')]
    assert codes == ['aaa', 'zzz']
