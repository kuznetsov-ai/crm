import pytest
from decimal import Decimal
from rest_framework.exceptions import ValidationError
from apps.workspaces.models import Workspace
from apps.custom_fields.models import CustomFieldDef, CustomFieldValue, Entity, FieldType
from apps.custom_fields.values import read_values, write_values


@pytest.fixture
def ws(db):
    return Workspace.objects.get(slug='idev')


@pytest.fixture
def deal_defs(ws):
    """Create a set of deal custom field defs."""
    defs = {}
    for code, label, ftype, opts in [
        ('inn', 'ИНН', FieldType.STRING, []),
        ('revenue', 'Revenue', FieldType.NUMBER, []),
        ('close_date', 'Close Date', FieldType.DATE, []),
        ('is_vip', 'VIP', FieldType.BOOLEAN, []),
        ('priority', 'Priority', FieldType.ENUM,
         [{'code': 'high', 'label': 'High'}, {'code': 'low', 'label': 'Low'}]),
        ('tags', 'Tags', FieldType.MULTI_ENUM,
         [{'code': 'hot', 'label': 'Hot'}, {'code': 'cold', 'label': 'Cold'}]),
    ]:
        defs[code] = CustomFieldDef.objects.create(
            workspace=ws, entity=Entity.DEAL, code=code, label=label,
            type=ftype, options=opts,
        )
    return defs


@pytest.mark.django_db
def test_read_values_empty(ws):
    """No defs → empty dict."""
    result = read_values('deal', 999, ws)
    assert result == {}


@pytest.mark.django_db
def test_write_and_read_string(ws, deal_defs):
    write_values('deal', 1, ws, {'inn': '7707083893'})
    result = read_values('deal', 1, ws)
    assert result['inn'] == '7707083893'


@pytest.mark.django_db
def test_write_and_read_number(ws, deal_defs):
    write_values('deal', 2, ws, {'revenue': '100500.50'})
    result = read_values('deal', 2, ws)
    assert result['revenue'] == Decimal('100500.50')


@pytest.mark.django_db
def test_write_and_read_date(ws, deal_defs):
    write_values('deal', 3, ws, {'close_date': '2026-12-31'})
    result = read_values('deal', 3, ws)
    assert result['close_date'] == '2026-12-31'


@pytest.mark.django_db
def test_write_and_read_boolean(ws, deal_defs):
    write_values('deal', 4, ws, {'is_vip': True})
    result = read_values('deal', 4, ws)
    assert result['is_vip'] is True


@pytest.mark.django_db
def test_write_and_read_enum(ws, deal_defs):
    write_values('deal', 5, ws, {'priority': 'high'})
    result = read_values('deal', 5, ws)
    assert result['priority'] == 'high'


@pytest.mark.django_db
def test_write_and_read_multi_enum(ws, deal_defs):
    write_values('deal', 6, ws, {'tags': ['hot', 'cold']})
    result = read_values('deal', 6, ws)
    assert result['tags'] == ['hot', 'cold']


@pytest.mark.django_db
def test_enum_invalid_value_raises(ws, deal_defs):
    with pytest.raises(ValidationError) as exc_info:
        write_values('deal', 7, ws, {'priority': 'unknown'})
    assert 'priority' in exc_info.value.detail


@pytest.mark.django_db
def test_number_invalid_value_raises(ws, deal_defs):
    with pytest.raises(ValidationError):
        write_values('deal', 8, ws, {'revenue': 'not_a_number'})


@pytest.mark.django_db
def test_unknown_code_raises(ws, deal_defs):
    with pytest.raises(ValidationError) as exc_info:
        write_values('deal', 9, ws, {'nonexistent': 'value'})
    assert 'nonexistent' in exc_info.value.detail


@pytest.mark.django_db
def test_write_updates_existing(ws, deal_defs):
    write_values('deal', 10, ws, {'inn': 'first'})
    write_values('deal', 10, ws, {'inn': 'second'})
    result = read_values('deal', 10, ws)
    assert result['inn'] == 'second'
    # Only one value row
    assert CustomFieldValue.objects.filter(
        workspace=ws, field=deal_defs['inn'], entity='deal', entity_id=10
    ).count() == 1


@pytest.mark.django_db
def test_required_field_missing_raises(ws):
    f = CustomFieldDef.objects.create(
        workspace=ws, entity=Entity.CLIENT, code='req_field', label='Required',
        type=FieldType.STRING, required=True,
    )
    with pytest.raises(ValidationError) as exc_info:
        write_values('client', 999, ws, {'req_field': ''})
    assert 'req_field' in exc_info.value.detail
