"""
Helpers for reading and writing typed custom field values.
"""
from decimal import Decimal, InvalidOperation
from datetime import date, datetime

from rest_framework import serializers

from .models import CustomFieldDef, CustomFieldValue, FieldType


def _cast_value(field_def: CustomFieldDef, raw):
    """
    Cast *raw* to the appropriate Python type for *field_def*.
    Raises serializers.ValidationError on type/validation failure.
    """
    code = field_def.code
    ftype = field_def.type

    if raw is None or raw == '':
        if field_def.required:
            raise serializers.ValidationError({code: 'This field is required.'})
        return None, None  # (column_name, value)

    # ── String-like types ────────────────────────────────────────────────────
    if ftype in (FieldType.STRING, FieldType.TEXT, FieldType.URL, FieldType.EMAIL):
        return 'value_text', str(raw)

    # ── Number ───────────────────────────────────────────────────────────────
    if ftype == FieldType.NUMBER:
        try:
            return 'value_number', Decimal(str(raw))
        except InvalidOperation:
            raise serializers.ValidationError({code: f'Invalid number: {raw!r}'})

    # ── Date ─────────────────────────────────────────────────────────────────
    if ftype == FieldType.DATE:
        if isinstance(raw, date) and not isinstance(raw, datetime):
            return 'value_date', raw
        try:
            return 'value_date', date.fromisoformat(str(raw))
        except (ValueError, TypeError):
            raise serializers.ValidationError({code: f'Invalid date (expected ISO 8601): {raw!r}'})

    # ── Datetime ─────────────────────────────────────────────────────────────
    if ftype == FieldType.DATETIME:
        if isinstance(raw, datetime):
            return 'value_datetime', raw
        try:
            return 'value_datetime', datetime.fromisoformat(str(raw))
        except (ValueError, TypeError):
            raise serializers.ValidationError({code: f'Invalid datetime (expected ISO 8601): {raw!r}'})

    # ── Boolean ──────────────────────────────────────────────────────────────
    if ftype == FieldType.BOOLEAN:
        if isinstance(raw, bool):
            return 'value_bool', raw
        if str(raw).lower() in ('true', '1', 'yes'):
            return 'value_bool', True
        if str(raw).lower() in ('false', '0', 'no'):
            return 'value_bool', False
        raise serializers.ValidationError({code: f'Invalid boolean: {raw!r}'})

    # ── Enum ─────────────────────────────────────────────────────────────────
    if ftype == FieldType.ENUM:
        valid_codes = {opt['code'] for opt in (field_def.options or [])}
        if str(raw) not in valid_codes:
            raise serializers.ValidationError(
                {code: f'Invalid enum value {raw!r}. Valid codes: {sorted(valid_codes)}'}
            )
        return 'value_text', str(raw)

    # ── Multi-enum ───────────────────────────────────────────────────────────
    if ftype == FieldType.MULTI_ENUM:
        valid_codes = {opt['code'] for opt in (field_def.options or [])}
        if not isinstance(raw, list):
            raise serializers.ValidationError({code: 'Expected a list of codes for multi_enum.'})
        for item in raw:
            if str(item) not in valid_codes:
                raise serializers.ValidationError(
                    {code: f'Invalid enum value {item!r}. Valid codes: {sorted(valid_codes)}'}
                )
        return 'value_json', list(raw)

    # Fallback
    return 'value_text', str(raw)


def _get_value(cfv: CustomFieldValue, ftype: str):
    """Extract Python value from a CustomFieldValue row based on field type."""
    if ftype in (FieldType.STRING, FieldType.TEXT, FieldType.URL, FieldType.EMAIL, FieldType.ENUM):
        return cfv.value_text
    if ftype == FieldType.NUMBER:
        return cfv.value_number
    if ftype == FieldType.DATE:
        return cfv.value_date.isoformat() if cfv.value_date else None
    if ftype == FieldType.DATETIME:
        return cfv.value_datetime.isoformat() if cfv.value_datetime else None
    if ftype == FieldType.BOOLEAN:
        return cfv.value_bool
    if ftype == FieldType.MULTI_ENUM:
        return cfv.value_json
    return cfv.value_text


def read_values(entity: str, entity_id: int, workspace) -> dict:
    """
    Returns {code: python_value} for the given entity instance.
    Only active field defs for the workspace are considered.
    """
    defs = CustomFieldDef.objects.filter(
        workspace=workspace, entity=entity, is_active=True
    ).order_by('order')

    if not defs.exists():
        return {}

    values_qs = CustomFieldValue.objects.filter(
        workspace=workspace, entity=entity, entity_id=entity_id,
        field__in=defs,
    ).select_related('field')

    value_map = {v.field_id: v for v in values_qs}

    result = {}
    for field_def in defs:
        cfv = value_map.get(field_def.pk)
        if cfv is None:
            result[field_def.code] = None
        else:
            result[field_def.code] = _get_value(cfv, field_def.type)

    return result


def write_values(entity: str, entity_id: int, workspace, payload: dict):
    """
    Takes {code: value} dict, validates each against its CustomFieldDef,
    upserts CustomFieldValue rows.
    Raises serializers.ValidationError on any validation failure.
    """
    if not payload:
        return

    defs_qs = CustomFieldDef.objects.filter(
        workspace=workspace, entity=entity, is_active=True,
    )
    def_map = {d.code: d for d in defs_qs}

    errors = {}
    upserts = []

    for code, raw in payload.items():
        field_def = def_map.get(code)
        if field_def is None:
            errors[code] = f'Unknown custom field code: {code!r}'
            continue
        try:
            col_name, casted = _cast_value(field_def, raw)
        except serializers.ValidationError as exc:
            errors.update(exc.detail)
            continue

        upserts.append((field_def, col_name, casted))

    if errors:
        raise serializers.ValidationError(errors)

    # Check required fields that are NOT in payload (only for required defs)
    for code, field_def in def_map.items():
        if field_def.required and code not in payload:
            # Only enforce if no existing value
            if not CustomFieldValue.objects.filter(
                workspace=workspace, field=field_def, entity=entity, entity_id=entity_id
            ).exists():
                errors[code] = 'This field is required.'

    if errors:
        raise serializers.ValidationError(errors)

    for field_def, col_name, casted in upserts:
        # Clear all value columns then set the right one
        defaults = {
            'value_text': None,
            'value_number': None,
            'value_date': None,
            'value_datetime': None,
            'value_bool': None,
            'value_json': None,
            'workspace': workspace,
        }
        if col_name is not None and casted is not None:
            defaults[col_name] = casted

        CustomFieldValue.objects.update_or_create(
            field=field_def,
            entity=entity,
            entity_id=entity_id,
            defaults=defaults,
        )
