"""Bench / utilization seed data.

Pure stand-in until the idev-hr integration lands. Generated deterministically from
the user list so demos always show the same roster without real HR data.
"""
from __future__ import annotations
import hashlib
from datetime import date, timedelta
from apps.users.models import User


SKILL_BUCKETS = [
    ['Python', 'Django', 'PostgreSQL'],
    ['Java', 'Spring', 'Kafka'],
    ['React', 'TypeScript', 'Next.js'],
    ['Go', 'gRPC', 'Kubernetes'],
    ['Node.js', 'NestJS', 'MongoDB'],
    ['Business Analysis', 'SQL', 'Confluence'],
    ['Systems Analysis', 'UML', 'BPMN'],
    ['DevOps', 'AWS', 'Terraform'],
    ['QA Automation', 'Playwright', 'Python'],
    ['Data', 'ClickHouse', 'Airflow'],
]

ROLES = ['Developer — Junior', 'Developer — Middle', 'Developer — Senior',
         'Developer — Lead', 'Business Analyst', 'System Analyst', 'QA', 'DevOps']


def _seed_int(email: str, salt: str, modulo: int) -> int:
    """Deterministic pseudo-random int from an email + salt."""
    h = hashlib.sha256(f'{email}|{salt}'.encode()).hexdigest()
    return int(h[:8], 16) % modulo


def _rolloff_date(email: str) -> date | None:
    """Some consultants have a known roll-off date."""
    offset = _seed_int(email, 'rolloff', 180)
    if offset < 20:
        return None  # no scheduled roll-off
    return date.today() + timedelta(days=offset)


def bench_roster() -> list[dict]:
    """Return a list of consultant rows with util %, role, skills, roll-off."""
    users = list(User.objects.filter(is_active=True).order_by('id'))
    rows: list[dict] = []
    for u in users:
        email = u.email
        util = _seed_int(email, 'util', 101)  # 0..100
        role = ROLES[_seed_int(email, 'role', len(ROLES))]
        skills = SKILL_BUCKETS[_seed_int(email, 'skills', len(SKILL_BUCKETS))]
        rows.append({
            'user_id': u.id,
            'name': u.full_name or u.email,
            'email': u.email,
            'role': role,
            'utilization_pct': util,
            'skills': skills,
            'rolloff_date': _rolloff_date(email).isoformat() if _rolloff_date(email) else None,
            'current_client': None if util < 20 else f'Client-{_seed_int(email, "client", 15) + 1}',
        })
    # Sort by utilization ascending (bench first)
    rows.sort(key=lambda r: r['utilization_pct'])
    return rows
