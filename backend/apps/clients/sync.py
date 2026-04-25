"""Background enrichment sync for a Client.

Runs enrichment tasks (website scrape → AI profile, ЕГРЮЛ by ИНН, HH suggest by
name) in a daemon thread. No Celery on purpose — the CRM is small and tasks are
idempotent + short-lived. Moves the client row through pending → in_progress →
done/failed and keeps a JSON blob `sync_data` with the latest result for each
source.
"""
from __future__ import annotations
import threading
from django.utils import timezone
from .models import Client


def enqueue_sync(client_id: int) -> None:
    """Kick off a background sync for the given client. Fire-and-forget."""
    t = threading.Thread(target=_run_sync, args=(client_id,), daemon=True)
    t.start()


def _run_sync(client_id: int) -> None:
    from django.db import close_old_connections
    try:
        _perform_sync(client_id)
    finally:
        close_old_connections()


def _perform_sync(client_id: int) -> None:
    try:
        client = Client.objects.get(pk=client_id)
    except Client.DoesNotExist:
        return

    Client.objects.filter(pk=client_id).update(sync_status='in_progress', sync_error='')

    result: dict = dict(client.sync_data or {})

    # 1. Lead enrichment from website
    try:
        from apps.ai.views import LeadEnrichView  # to reuse extraction helpers
        from apps.ai.views import _fetch_company_pages, _html_to_text, _extract_contacts, _safe_json, LEAD_ENRICH_SYSTEM, _language_instruction
        from apps.ai.client import call_claude
        if client.website:
            from urllib.parse import urlparse
            domain = urlparse(client.website if '://' in client.website else f'https://{client.website}').netloc or client.website
            pages = _fetch_company_pages(domain)
            if pages:
                combined = ''
                for path, html in pages.items():
                    combined += f'\n\n--- page: {path} ---\n{_html_to_text(html)[:5000]}'
                signals = _extract_contacts('\n'.join(pages.values()))
                prompt = (
                    f"Domain: {domain}\n\n"
                    f"Signals: emails={signals['emails']} phones={signals['phones']}\n\n"
                    f"Text:\n{combined[:15000]}"
                )
                system = LEAD_ENRICH_SYSTEM + '\n\n' + _language_instruction(_SystemUser())
                answer = call_claude(system=system, user=prompt, max_tokens=1200)
                parsed = _safe_json(answer) or {'raw': answer}
                parsed['domain'] = domain
                parsed['scraped_pages'] = list(pages.keys())
                parsed['raw_signals'] = signals
                result['enriched'] = parsed
    except Exception as exc:
        result['enriched_error'] = f'{type(exc).__name__}: {exc}'

    # 2. ЕГРЮЛ by ИНН (only for RU tax_id)
    try:
        if client.tax_id and (client.tax_id_country or 'RU').upper() == 'RU':
            from apps.ai.ru_company import fetch_egrul, fetch_dadata_financials
            egrul = fetch_egrul(client.tax_id)
            if egrul and not egrul.get('error'):
                result['egrul'] = egrul
                # Auto-fill fields from ЕГРЮЛ if they were empty
                if not client.name or client.name.lower() in (egrul.get('name_short', '').lower(), egrul.get('name_full', '').lower(), ''):
                    # Don't overwrite intentional names
                    pass
            financials = fetch_dadata_financials(client.tax_id)
            if financials:
                result['financials'] = financials
    except Exception as exc:
        result['egrul_error'] = f'{type(exc).__name__}: {exc}'

    # 3. HH suggest by company name
    try:
        from apps.ai.hh import suggest_employers
        hh = suggest_employers(client.name, limit=5)
        result['hh'] = hh
    except Exception as exc:
        result['hh_error'] = f'{type(exc).__name__}: {exc}'

    # 4. Auto-create contacts from enrichment, only if the client has none yet
    try:
        from .models import Contact
        if client.contacts.count() == 0:
            contacts = ((result.get('enriched') or {}).get('contacts') or [])[:10]
            for idx, c in enumerate(contacts):
                if not (c.get('full_name') or c.get('email') or c.get('phone')):
                    continue
                first, *rest = (c.get('full_name') or c.get('email', '').split('@')[0] or 'Contact').split(' ')
                Contact.objects.create(
                    client=client,
                    first_name=first or 'Contact',
                    last_name=' '.join(rest),
                    email=c.get('email') or '',
                    phone=c.get('phone') or '',
                    linkedin=c.get('linkedin') or '',
                    position=c.get('position') or '',
                    role='decision_maker' if c.get('is_decision_maker') else 'other',
                    is_primary=idx == 0,
                )
            # Also create a contact from ЕГРЮЛ director if no person-contacts yet
            director = (result.get('egrul') or {}).get('director')
            if director and director.get('full_name') and client.contacts.count() == 0:
                parts = director['full_name'].split()
                last, first, *mid = parts + ['', '', '']
                Contact.objects.create(
                    client=client,
                    first_name=first or 'Директор',
                    last_name=last,
                    position=director.get('position', 'Руководитель'),
                    role='decision_maker',
                    is_primary=True,
                    notes='Импортирован из ЕГРЮЛ',
                )
    except Exception as exc:
        result['contacts_error'] = f'{type(exc).__name__}: {exc}'

    # Persist
    Client.objects.filter(pk=client_id).update(
        sync_status='done',
        sync_error='',
        last_synced_at=timezone.now(),
        sync_data=result,
    )

    # Recompute risk after sync (new contacts / data might change factors)
    try:
        from .risk import apply_risk
        fresh = Client.objects.get(pk=client_id)
        apply_risk(fresh)
    except Exception:
        pass


class _SystemUser:
    """Stand-in for request.user inside the background job."""
    language = 'ru'
