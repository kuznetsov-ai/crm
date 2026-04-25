"""
Demo-mode endpoints.

Active only when DEMO_MODE=true.
"""
import os
import time
from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

DEMO_RESET_LOCK_FILE = Path('/tmp/studio_crm_demo_reset.lock')
DEMO_RESET_STAMP_FILE = Path('/tmp/studio_crm_demo_reset.stamp')


def _is_demo_mode() -> bool:
    return getattr(settings, 'DEMO_MODE', False)


def _last_reset_ts() -> float:
    try:
        return DEMO_RESET_STAMP_FILE.stat().st_mtime
    except FileNotFoundError:
        return 0.0


def _stamp_reset():
    DEMO_RESET_STAMP_FILE.touch()


@api_view(['GET'])
@permission_classes([AllowAny])
def info(request):
    """Public endpoint — exposes demo status, last reset time."""
    last_reset = _last_reset_ts()
    return Response({
        'demo_mode': _is_demo_mode(),
        'last_reset': last_reset,
        'last_reset_iso': (
            time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(last_reset))
            if last_reset else None
        ),
        'reset_interval_hours': int(os.environ.get('DEMO_RESET_INTERVAL_HOURS', '24')),
        'demo_user_email': 'demo@studio.crm',
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def reset(request):
    """
    Manual demo reset. Wipes data and reloads fixtures.

    Guards:
    - DEMO_MODE must be true.
    - Re-entrancy guard via filesystem lock — concurrent calls return 429.
    """
    if not _is_demo_mode():
        return Response({'error': 'demo_mode_disabled'}, status=status.HTTP_403_FORBIDDEN)

    # crude lock: refuse if another reset is in flight (within 30s)
    try:
        if DEMO_RESET_LOCK_FILE.exists():
            age = time.time() - DEMO_RESET_LOCK_FILE.stat().st_mtime
            if age < 30:
                return Response(
                    {'error': 'reset_in_progress', 'retry_after_s': int(30 - age)},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )
    except OSError:
        pass

    DEMO_RESET_LOCK_FILE.touch()
    try:
        # flush all data, then re-run the demo seed command
        call_command('flush', '--no-input')
        call_command('seed_demo', '--force')
        _stamp_reset()
    finally:
        try:
            DEMO_RESET_LOCK_FILE.unlink()
        except FileNotFoundError:
            pass

    return Response({'ok': True, 'reset_at': time.time()})
