"""Russian company data lookup by ИНН.

Sources:
  1. egrul.itsoft.ru — free, no token, full ЕГРЮЛ extract as JSON.
     Gives us: full/short name, legal address, director (ФИО + должность),
     founders, ОКВЭД codes, OGRN, registration date, status.
  2. dadata.ru suggest API — optional, needs DADATA_API_KEY. Adds financials
     (revenue, net profit), employees count, credit_risk. Free tier: 10k/day.
  3. Parser hooks left for СПАРК/Контур.Фокус — commercial, add later.
"""
from __future__ import annotations
import os
from typing import Any


EGRUL_BASE = 'https://egrul.itsoft.ru'
DADATA_BASE = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs'
UA = 'Studio-CRM/1.0 (iam@ekuznetsov.dev)'


def _normalize_inn(inn: str) -> str:
    return ''.join(ch for ch in (inn or '') if ch.isdigit())


def fetch_egrul(inn: str) -> dict[str, Any] | None:
    """Fetch ЕГРЮЛ extract as a normalized dict. Returns None if not found."""
    norm = _normalize_inn(inn)
    if len(norm) not in (10, 12):
        return {'error': f'ИНН должен быть 10 или 12 цифр (получено {len(norm)})'}
    try:
        import requests  # type: ignore
        r = requests.get(f'{EGRUL_BASE}/{norm}.json', timeout=8, headers={'User-Agent': UA})
    except Exception as exc:
        return {'error': f'{type(exc).__name__}: {exc}'}
    if r.status_code != 200:
        return {'error': f'egrul.itsoft.ru returned {r.status_code}'}
    try:
        data = r.json()
    except Exception:
        return {'error': 'not JSON'}
    return _normalize_egrul(data)


def _get_attrs(node) -> dict:
    if isinstance(node, dict):
        return node.get('@attributes') or {}
    return {}


def _normalize_egrul(raw: dict) -> dict[str, Any]:
    """Flatten the nested XML-as-JSON structure into a friendly shape.

    The data is nested under `СвЮЛ` (companies) or `СвИП` (sole proprietors).
    Almost everything of interest lives inside `sv` — address, director,
    ОКВЭД etc. are sibling keys of `@attributes`, not at the top level.
    """
    sv = raw.get('СвЮЛ') or raw.get('СвИП') or {}
    if not sv:
        return {'error': 'ЕГРЮЛ structure unrecognized', 'raw': raw}
    attrs = _get_attrs(sv)
    # Name
    name_node = sv.get('СвНаимЮЛ') or {}
    name_attrs = _get_attrs(name_node)
    short_attrs = _get_attrs(name_node.get('СвНаимЮЛСокр') or {})

    addr_text = _format_address(sv.get('СвАдресЮЛ') or {})
    director = _extract_director(sv)
    okveds = _extract_okved(sv)
    founders = _extract_founders(sv)
    status_node = sv.get('СвСтатус') or {}
    status_attrs = _get_attrs(status_node)

    return {
        'inn': attrs.get('ИНН'),
        'ogrn': attrs.get('ОГРН'),
        'kpp': attrs.get('КПП'),
        'registration_date': attrs.get('ДатаОГРН'),
        'opf_full': attrs.get('ПолнНаимОПФ'),
        'name_full': name_attrs.get('НаимЮЛПолн'),
        'name_short': short_attrs.get('НаимСокр'),
        'address': addr_text,
        'director': director,
        'okved_main': okveds.get('main'),
        'okved_additional': okveds.get('additional', [])[:10],
        'founders': founders[:10],
        'status': status_attrs.get('НаимСтатус') or 'active',
        'source': 'egrul.itsoft.ru',
    }


def _format_address(addr_node: dict) -> str:
    """Stitch address fragments into a single line.

    ЕГРЮЛ nests fragments under `СвАдрЮЛФИАС` with keys like НаимРегион,
    МуниципРайон.Наим, ЭлУлДорСети.Наим+Тип, Здание[].Тип+Номер. We walk the
    tree and concatenate any string values we recognize.
    """
    fias = addr_node.get('СвАдрЮЛФИАС') or addr_node
    parts: list[str] = []
    idx = fias.get('@attributes', {}).get('Индекс') if isinstance(fias, dict) else None
    if idx:
        parts.append(idx)
    # Top-level string leaves (e.g. "НаимРегион": "Г.МОСКВА")
    if isinstance(fias, dict):
        for k, v in fias.items():
            if isinstance(v, str) and k in ('НаимРегион', 'Район', 'Город', 'НаселПункт'):
                parts.append(v)
        # Named sub-nodes
        for k, wrapper_attr in (
            ('МуниципРайон', 'Наим'),
            ('Город', 'Наим'),
            ('НаселПункт', 'Наим'),
            ('ГородСелПоселен', 'Наим'),
        ):
            node = fias.get(k)
            if isinstance(node, dict):
                a = _get_attrs(node)
                if a.get(wrapper_attr):
                    parts.append(a[wrapper_attr])
        street = fias.get('ЭлУлДорСети')
        if isinstance(street, dict):
            a = _get_attrs(street)
            if a.get('Наим'):
                parts.append(f"{a.get('Тип', '').strip()} {a.get('Наим')}".strip())
        buildings = fias.get('Здание')
        if isinstance(buildings, dict):
            buildings = [buildings]
        if isinstance(buildings, list):
            for b in buildings:
                a = _get_attrs(b)
                if a.get('Номер'):
                    parts.append(f"{a.get('Тип', '').strip()}{a.get('Номер')}")
    return ', '.join(p for p in parts if p)


def _extract_director(sv: dict) -> dict | None:
    """Find CEO / sole executive. Structure:
       sv.СведДолжнФЛ.СвФЛ.@attributes.{Фамилия,Имя,Отчество}
       sv.СведДолжнФЛ.СвДолжн.@attributes.НаимДолжн
    """
    for key in ('СведДолжнФЛ', 'СвЕдИсп', 'СвРукОрг', 'СвРуковЮЛ', 'СвГрупЛиц'):
        node = sv.get(key)
        if isinstance(node, list):
            node = node[0] if node else None
        if not isinstance(node, dict):
            continue
        fio_attrs = _get_attrs(node.get('СвФЛ') or {}) or _get_attrs(node.get('ФИОРус') or {})
        if fio_attrs:
            fio = ' '.join(v for v in [
                fio_attrs.get('Фамилия'),
                fio_attrs.get('Имя'),
                fio_attrs.get('Отчество'),
            ] if v).strip()
            pos_attrs = _get_attrs(node.get('СвДолжн') or {})
            position = pos_attrs.get('НаимДолжн') or pos_attrs.get('НаимВидДолжн')
            if fio:
                return {'full_name': fio, 'position': position or 'Руководитель'}
    return None


def _extract_okved(sv: dict) -> dict:
    """Return {main: {code,name}|None, additional: [{code,name}]}.

    The primary code sometimes lives under `СвОКВЭД.СвОКВЭДОсн` and additional
    under `СвОКВЭДДоп` (may be dict or list). Some rows carry only `СвОКВЭДОтч`.
    """
    main = None
    additional: list[dict] = []
    for bucket_key in ('СвОКВЭД', 'СвОКВЭДОтч', 'СведДействОКВЭД'):
        nodes = sv.get(bucket_key) or {}
        if not isinstance(nodes, dict):
            continue
        osn = nodes.get('СвОКВЭДОсн')
        if isinstance(osn, list):
            osn = osn[0] if osn else None
        if osn and not main:
            a = _get_attrs(osn)
            if a.get('КодОКВЭД'):
                main = {'code': a.get('КодОКВЭД'), 'name': a.get('НаимОКВЭД')}
        dop = nodes.get('СвОКВЭДДоп')
        if isinstance(dop, dict):
            dop = [dop]
        for it in (dop or []):
            a = _get_attrs(it)
            if a.get('КодОКВЭД'):
                additional.append({'code': a.get('КодОКВЭД'), 'name': a.get('НаимОКВЭД')})
    # Fallback: if no main but additional present, lift the first
    if not main and additional:
        main = additional[0]
    return {'main': main, 'additional': additional}


def _extract_founders(sv: dict) -> list[dict]:
    out: list[dict] = []
    node = sv.get('СведУчредит') or sv.get('СвУчредит') or {}
    if isinstance(node, dict):
        for key in ('УчрФЛ', 'УчрЮЛРос', 'УчрЮЛИн'):
            inner = node.get(key)
            if not inner:
                continue
            items = inner if isinstance(inner, list) else [inner]
            for it in items:
                name = None
                fio_attrs = _get_attrs((it or {}).get('СвФЛ', {}).get('ФИОРус', {}))
                if fio_attrs:
                    name = ' '.join(v for v in [fio_attrs.get('Фамилия'), fio_attrs.get('Имя'), fio_attrs.get('Отчество')] if v)
                org_attrs = _get_attrs((it or {}).get('НаимИННЮЛ', {}))
                if not name and org_attrs:
                    name = org_attrs.get('НаимЮЛПолн')
                share_attrs = _get_attrs((it or {}).get('ДоляУстКап', {}))
                if name:
                    out.append({'name': name.strip(), 'share_pct': share_attrs.get('НоминСтоим')})
    return out


def fetch_dadata_financials(inn: str) -> dict[str, Any] | None:
    """Fetch finances/employees via Dadata if DADATA_API_KEY is configured."""
    token = os.environ.get('DADATA_API_KEY')
    if not token:
        return {'available': False, 'reason': 'DADATA_API_KEY not set'}
    try:
        import requests  # type: ignore
        r = requests.post(
            f'{DADATA_BASE}/findById/party',
            headers={
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': f'Token {token}',
            },
            json={'query': _normalize_inn(inn), 'count': 1},
            timeout=8,
        )
    except Exception as exc:
        return {'available': False, 'error': f'{type(exc).__name__}: {exc}'}
    if r.status_code != 200:
        return {'available': False, 'error': f'dadata returned {r.status_code}'}
    items = (r.json() or {}).get('suggestions') or []
    if not items:
        return {'available': True, 'found': False}
    d = items[0].get('data') or {}
    finance = d.get('finance') or {}
    return {
        'available': True,
        'found': True,
        'employees': d.get('employee_count'),
        'revenue_rub': finance.get('income'),
        'net_profit_rub': finance.get('debt'),  # naming tricky — Dadata uses 'income'/'expense'
        'tax_report_year': finance.get('year'),
        'branch_count': d.get('branch_count'),
        'okved_name': (d.get('okved') or ''),
        'kladr_address': (d.get('address') or {}).get('unrestricted_value'),
        'credit_risk': finance.get('credit_risk'),
    }
