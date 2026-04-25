import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { currencyApi, type CurrencyRate } from '../../api/currency'

const SUB_PAGES = [
  { to: '/settings/pipelines',      label: 'Воронки продаж',    desc: 'Управление пайплайнами и стадиями' },
  { to: '/settings/dictionaries',   label: 'Справочники',       desc: 'Источники, причины отказа' },
  { to: '/settings/custom-fields',  label: 'Кастомные поля',    desc: 'Дополнительные поля для сущностей' },
]

function CurrencyBlock() {
  const { t } = useTranslation()
  const [currency, setCurrency] = useState<'USD' | 'RUB'>('USD')
  const [rate, setRate] = useState<CurrencyRate | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)

  useEffect(() => {
    Promise.all([
      currencyApi.getSettings(),
      currencyApi.getRate(),
    ]).then(([settings, r]) => {
      setCurrency(settings.currency)
      setRate(r)
    }).finally(() => setLoadingSettings(false))
  }, [])

  const handleCurrencyChange = async (val: 'USD' | 'RUB') => {
    setCurrency(val)
    await currencyApi.patchSettings(val)
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const fresh = await currencyApi.syncRate()
      setRate(fresh)
    } catch {
      // ignore
    } finally {
      setSyncing(false)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-medium text-[var(--text)] mb-1">
            {t('settings.currency.displayLabel', 'Валюта отображения')}
          </div>
          <select
            value={currency}
            onChange={e => handleCurrencyChange(e.target.value as 'USD' | 'RUB')}
            disabled={loadingSettings}
            className="text-sm border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] rounded px-3 py-1.5 focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="USD">USD ($)</option>
            <option value="RUB">RUB (₽)</option>
          </select>
        </div>

        <button
          onClick={handleSync}
          disabled={syncing}
          className="text-sm bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
        >
          {syncing ? t('settings.currency.syncing', 'Обновляем...') : t('settings.currency.syncBtn', 'Обновить курс')}
        </button>
      </div>

      {/* Rate display */}
      <div className="text-sm text-[var(--text-secondary)]">
        {rate ? (
          <>
            1 USD = <span className="font-semibold text-[var(--text)]">{parseFloat(rate.rate).toFixed(2)} RUB</span>
            {' '}&middot;{' '}
            {t('settings.currency.syncLabel', 'sync')}: {formatDate(rate.fetched_at)}
            {' '}&middot;{' '}
            {t('settings.currency.source', 'источник')}: {rate.source}
          </>
        ) : (
          <span className="italic">
            {t('settings.currency.noRate', 'Нет курса. Нажмите «Обновить курс» для синхронизации.')}
          </span>
        )}
      </div>
    </div>
  )
}

export default function OtherSettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-8">
      {/* Sub-navigation cards */}
      <section>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3 pb-2 border-b border-[var(--border)]">
          {t('settings.configTitle', 'Настройки системы')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SUB_PAGES.map(({ to, label, desc }) => (
            <Link
              key={to}
              to={to}
              className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--accent)] transition-colors"
            >
              <div className="text-sm font-medium text-[var(--text)]">{label}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">{desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Currency */}
      <section>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3 pb-2 border-b border-[var(--border)]">
          {t('settings.currency.sectionTitle', 'Валюта')}
        </h2>
        <CurrencyBlock />
      </section>

      {/* System info */}
      <section>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3 pb-2 border-b border-[var(--border)]">
          {t('settings.systemTitle')}
        </h2>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">{t('settings.version')}</span>
            <span className="text-[var(--text)] font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">{t('settings.stack')}</span>
            <span className="text-[var(--text)]">Django 5 + React 19</span>
          </div>
        </div>
      </section>
    </div>
  )
}
