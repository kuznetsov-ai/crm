"""Tests for CurrencyRate model, sync command, and currency API endpoints."""
import json
from decimal import Decimal
from unittest.mock import patch, MagicMock

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework.test import APIClient

from apps.workspaces.models import CurrencyRate, Workspace, Membership

User = get_user_model()

CBR_FIXTURE = {
    'Valute': {
        'USD': {
            'ID': 'R01235',
            'NumCode': '840',
            'CharCode': 'USD',
            'Nominal': 1,
            'Name': 'Доллар США',
            'Value': 92.35,
            'Previous': 91.80,
        }
    }
}


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCurrencyRateModel:
    def test_create_and_str(self):
        row = CurrencyRate.objects.create(base='USD', quote='RUB', rate=Decimal('92.350000'), source='test')
        assert 'USD' in str(row)
        assert 'RUB' in str(row)
        assert '92.350000' in str(row)

    def test_ordering_latest_first(self):
        CurrencyRate.objects.create(base='USD', quote='RUB', rate=Decimal('90.0'), source='test')
        CurrencyRate.objects.create(base='USD', quote='RUB', rate=Decimal('92.0'), source='test')
        rates = list(CurrencyRate.objects.filter(base='USD', quote='RUB'))
        assert rates[0].rate == Decimal('92.0')

    def test_defaults(self):
        row = CurrencyRate.objects.create(base='USD', quote='RUB', rate=Decimal('88.0'), source='cbr-xml-daily.ru')
        assert row.base == 'USD'
        assert row.quote == 'RUB'
        assert row.fetched_at is not None


# ---------------------------------------------------------------------------
# Management command tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestSyncCurrencyRateCommand:
    def _mock_response(self):
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = CBR_FIXTURE
        return mock_resp

    def test_creates_row(self):
        with patch('requests.get', return_value=self._mock_response()):
            call_command('sync_currency_rate')
        row = CurrencyRate.objects.filter(base='USD', quote='RUB').first()
        assert row is not None
        assert row.rate == Decimal('92.35')
        assert row.source == 'cbr-xml-daily.ru'

    def test_creates_multiple_rows_on_repeated_calls(self):
        with patch('requests.get', return_value=self._mock_response()):
            call_command('sync_currency_rate')
            call_command('sync_currency_rate')
        assert CurrencyRate.objects.filter(base='USD', quote='RUB').count() == 2

    def test_raises_on_network_error(self):
        with patch('requests.get', side_effect=Exception('timeout')):
            with pytest.raises(SystemExit):
                call_command('sync_currency_rate')


# ---------------------------------------------------------------------------
# Fixtures helpers
# ---------------------------------------------------------------------------

@pytest.fixture
def ws_user(db):
    u = User.objects.create_user(email='u@test.com', password='pw')
    ws = Workspace.objects.create(slug='test-ws', name='Test')
    Membership.objects.create(workspace=ws, user=u, role=Membership.Role.OWNER)
    u.current_workspace = ws
    u.save()
    return u, ws


@pytest.fixture
def auth_client(ws_user):
    u, ws = ws_user
    c = APIClient()
    c.force_authenticate(user=u)
    c.credentials(HTTP_X_WORKSPACE_SLUG=ws.slug)
    return c, ws


# ---------------------------------------------------------------------------
# Currency settings endpoint tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCurrencySettingsEndpoint:
    def test_get_default_usd(self, auth_client):
        c, ws = auth_client
        resp = c.get('/api/currency/settings/')
        assert resp.status_code == 200
        assert resp.data['currency'] == 'USD'

    def test_patch_to_rub(self, auth_client):
        c, ws = auth_client
        resp = c.patch('/api/currency/settings/', {'currency': 'RUB'}, format='json')
        assert resp.status_code == 200
        assert resp.data['currency'] == 'RUB'
        ws.refresh_from_db()
        assert ws.settings.get('currency') == 'RUB'

    def test_patch_invalid_currency(self, auth_client):
        c, ws = auth_client
        resp = c.patch('/api/currency/settings/', {'currency': 'EUR'}, format='json')
        assert resp.status_code == 400

    def test_patch_persists_other_settings(self, auth_client):
        c, ws = auth_client
        ws.settings = {'some_key': 'some_val'}
        ws.save()
        c.patch('/api/currency/settings/', {'currency': 'RUB'}, format='json')
        ws.refresh_from_db()
        assert ws.settings.get('some_key') == 'some_val'
        assert ws.settings.get('currency') == 'RUB'


# ---------------------------------------------------------------------------
# Currency rate endpoint tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestCurrencyRateEndpoint:
    def test_get_404_when_no_rate(self, auth_client):
        c, ws = auth_client
        resp = c.get('/api/currency/rate/', {'base': 'USD', 'quote': 'RUB'})
        assert resp.status_code == 404

    def test_get_returns_latest(self, auth_client):
        c, ws = auth_client
        CurrencyRate.objects.create(base='USD', quote='RUB', rate=Decimal('90.0'), source='test')
        CurrencyRate.objects.create(base='USD', quote='RUB', rate=Decimal('92.0'), source='test')
        resp = c.get('/api/currency/rate/', {'base': 'USD', 'quote': 'RUB'})
        assert resp.status_code == 200
        assert resp.data['rate'] == '92.000000'
        assert resp.data['source'] == 'test'

    def test_get_defaults_to_usd_rub(self, auth_client):
        c, ws = auth_client
        CurrencyRate.objects.create(base='USD', quote='RUB', rate=Decimal('88.0'), source='test')
        resp = c.get('/api/currency/rate/')
        assert resp.status_code == 200
        assert resp.data['base'] == 'USD'

    def test_sync_creates_rate(self, auth_client):
        c, ws = auth_client
        mock_resp = MagicMock()
        mock_resp.raise_for_status.return_value = None
        mock_resp.json.return_value = CBR_FIXTURE
        with patch('requests.get', return_value=mock_resp):
            resp = c.post('/api/currency/rate/sync/')
        assert resp.status_code == 200
        assert resp.data['rate'] == '92.350000'
        assert CurrencyRate.objects.filter(base='USD', quote='RUB').count() == 1
