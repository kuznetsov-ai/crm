"""Rule-based risk scoring for Client.

Explainable output: each rule returns a (code, weight, detail) record; the final
score is the clamped sum. A level enum is derived from the score.

Level thresholds (tunable):
  0–24   → low
  25–49  → medium
  50–74  → high
  75+    → critical
"""
from __future__ import annotations
from django.db.models import Q


def validate_tax_id(tax_id: str, country: str = 'RU') -> tuple[bool, str]:
    """Normalize and validate. Returns (ok, normalized_or_reason)."""
    digits = ''.join(ch for ch in (tax_id or '') if ch.isdigit())
    if not digits:
        return True, ''  # empty is allowed
    if country.upper() == 'RU':
        if len(digits) == 10:
            return True, digits
        if len(digits) == 12:
            return True, digits
        return False, f'ИНН должен быть 10 или 12 цифр (получено {len(digits)})'
    # Other countries — accept any 6–20 digits
    if 6 <= len(digits) <= 20:
        return True, digits
    return False, 'Tax ID length out of range (6–20 digits)'


def _score_to_level(score: int) -> str:
    if score >= 75:
        return 'critical'
    if score >= 50:
        return 'high'
    if score >= 25:
        return 'medium'
    return 'low'


def compute_risk(client, duplicate_qs=None) -> dict:
    """Compute risk for a client instance. Returns {score, level, factors: []}.

    Does NOT mutate the model; call `apply_risk()` to persist.
    """
    from .models import Client
    factors: list[dict] = []

    # Empty tax_id on non-lead stages is suspicious
    if not (client.tax_id or '').strip() and client.status not in ('lead',):
        factors.append({
            'code': 'missing_tax_id',
            'weight': 30,
            'detail': 'Нет ИНН у клиента вне статуса "Lead"',
        })

    # Duplicates by tax_id
    if (client.tax_id or '').strip():
        q = Client.objects.filter(tax_id=client.tax_id, tax_id_country=(client.tax_id_country or ''))
        if client.pk:
            q = q.exclude(pk=client.pk)
        dup_count = q.count()
        if dup_count > 0:
            factors.append({
                'code': 'duplicate_tax_id',
                'weight': 40,
                'detail': f'Найдено {dup_count} клиентов с таким же ИНН',
            })

    # No decision_maker contact on active client
    if client.pk and client.status in ('active', 'signed') and client.contacts.filter(role='decision_maker').count() == 0:
        factors.append({
            'code': 'no_decision_maker',
            'weight': 20,
            'detail': 'Активный клиент без контакта-ЛПР',
        })

    # No contacts at all (moderate risk)
    if client.pk and client.contacts.count() == 0:
        factors.append({
            'code': 'no_contacts',
            'weight': 15,
            'detail': 'Нет ни одного контактного лица',
        })

    # No website (low risk but a quality signal)
    if not (client.website or '').strip():
        factors.append({
            'code': 'no_website',
            'weight': 5,
            'detail': 'Не указан сайт',
        })

    score = sum(f['weight'] for f in factors)
    score = max(0, min(100, score))
    return {'score': score, 'level': _score_to_level(score), 'factors': factors}


def apply_risk(client, *, force: bool = False) -> dict:
    """Persist the computed risk on the model. Respects `risk_overridden` unless `force=True`."""
    if client.risk_overridden and not force:
        return {'skipped': True, 'reason': 'manual override', 'score': client.risk_score, 'level': client.risk_level}
    r = compute_risk(client)
    client.risk_score = r['score']
    client.risk_level = r['level']
    client.risk_factors = r['factors']
    client.save(update_fields=['risk_score', 'risk_level', 'risk_factors', 'updated_at'])
    return {**r, 'skipped': False}
