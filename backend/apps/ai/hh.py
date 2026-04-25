"""HeadHunter companies lookup.

HH's full /employers endpoint is behind OAuth now, but /suggests/employers is
public and returns id/name/url/logo for autocomplete. We wrap that into a
search-like API. Good enough to surface RU companies by free text and push the
user straight into the lead-enrichment flow.

Doc: https://api.hh.ru/openapi/redoc#tag/Autodopolnenie/operation/get-employer-suggests
"""
from __future__ import annotations
from urllib.parse import urlparse
from typing import Any


HH_BASE = 'https://api.hh.ru'
UA = 'Studio-CRM/1.0 (iam@ekuznetsov.dev)'


def _session():
    import requests  # type: ignore
    s = requests.Session()
    s.headers.update({'User-Agent': UA, 'HH-User-Agent': UA, 'Accept': 'application/json'})
    return s


def _normalize_domain(raw_url: str) -> str | None:
    """Pull a plausible company domain out of the url HH returns.

    Many HH records carry redirector URLs (e.g. `l.tinkoff.ru/...`,
    `career.X.com`). We strip known HH/career subdomains and keep the apex.
    """
    if not raw_url:
        return None
    p = urlparse(raw_url if '://' in raw_url else f'https://{raw_url}')
    host = (p.netloc or '').lower()
    if not host:
        return None
    # Trim redirector-style prefixes
    for prefix in ('l.', 'link.', 'go.', 'career.', 'careers.', 'www.'):
        if host.startswith(prefix):
            host = host[len(prefix):]
            break
    return host


def suggest_employers(query: str, limit: int = 10) -> list[dict[str, Any]]:
    """Public autocomplete — returns {id, name, url, logo, domain} rows."""
    if not (query or '').strip():
        return []
    try:
        s = _session()
        r = s.get(
            f'{HH_BASE}/suggests/employers',
            params={'text': query},
            timeout=8,
        )
    except Exception as exc:
        return [{'error': f'{type(exc).__name__}: {exc}'}]
    if r.status_code != 200:
        return [{'error': f'HH returned {r.status_code}'}]
    data = r.json() or {}
    items = data.get('items') or []
    rows: list[dict[str, Any]] = []
    for it in items[:limit]:
        url = it.get('url')
        rows.append({
            'hh_id': it.get('id'),
            'name': it.get('text'),
            'url': url,
            'domain': _normalize_domain(url or ''),
            'logo': (it.get('logo_urls') or {}).get('90'),
            'hh_page': f'https://hh.ru/employer/{it.get("id")}' if it.get('id') else None,
        })
    return rows
