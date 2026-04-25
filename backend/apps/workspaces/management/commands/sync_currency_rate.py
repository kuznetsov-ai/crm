import requests
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Fetch latest USD->RUB rate from CBR and store in CurrencyRate'

    def handle(self, *args, **opts):
        from apps.workspaces.models import CurrencyRate
        try:
            resp = requests.get('https://www.cbr-xml-daily.ru/daily_json.js', timeout=10)
            resp.raise_for_status()
            data = resp.json()
            rate = data['Valute']['USD']['Value']
            row = CurrencyRate.objects.create(
                base='USD',
                quote='RUB',
                rate=rate,
                source='cbr-xml-daily.ru',
            )
            self.stdout.write(self.style.SUCCESS(f'USD→RUB = {rate} (id {row.id})'))
        except Exception as exc:
            self.stderr.write(self.style.ERROR(f'sync_currency_rate failed: {exc}'))
            raise SystemExit(1)
