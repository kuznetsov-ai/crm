"""Fire-and-forget webhook dispatch with a minimal audit log.

No Celery / queues on purpose — this CRM is small. We fire synchronously with a
short timeout; the delivery row lets ops debug failures. For >1rps move to a
background worker.
"""
import hashlib
import hmac
import json
import time
from .models import WebhookEndpoint, WebhookDelivery


def dispatch(event: str, payload: dict) -> None:
    endpoints = WebhookEndpoint.objects.filter(active=True).exclude(events=[])
    for ep in endpoints:
        if event not in (ep.events or []):
            continue
        _deliver(ep, event, payload)


def _deliver(ep: WebhookEndpoint, event: str, payload: dict) -> None:
    try:
        import requests  # type: ignore
    except ImportError:
        return
    body = json.dumps({'event': event, 'data': payload}, default=str).encode()
    headers = {'Content-Type': 'application/json'}
    if ep.secret:
        sig = hmac.new(ep.secret.encode(), body, hashlib.sha256).hexdigest()
        headers['X-Studio-Signature'] = f'sha256={sig}'
    t0 = time.time()
    status = 0
    snippet = ''
    error = ''
    try:
        r = requests.post(ep.url, data=body, headers=headers, timeout=5)
        status = r.status_code
        snippet = r.text[:400]
    except Exception as exc:
        error = f'{type(exc).__name__}: {exc}'
    WebhookDelivery.objects.create(
        endpoint=ep,
        event=event,
        payload=payload,
        status_code=status,
        response_snippet=snippet,
        error=error,
        duration_ms=int((time.time() - t0) * 1000),
    )
