import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clientsApi, type Client } from '../../api/clients'

export default function SyncPanel({ client, onUpdated }: { client: Client; onUpdated: (c: Client) => void }) {
  const { t, i18n } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [ticks, setTicks] = useState(0)

  const run = async () => {
    setLoading(true)
    try {
      await clientsApi.sync(client.id)
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        const fresh = await clientsApi.get(client.id)
        setTicks((x) => x + 1)
        onUpdated(fresh)
        if (fresh.sync_status !== 'in_progress' && fresh.sync_status !== 'pending') break
      }
    } finally {
      setLoading(false)
    }
  }

  const egrul = client.sync_data?.egrul
  const financials = client.sync_data?.financials
  const hh = client.sync_data?.hh || []
  const enriched = client.sync_data?.enriched as {
    name?: string; industry?: string; contacts?: unknown[];
    raw_signals?: { emails?: string[]; phones?: string[] }
  } | undefined

  const status = client.sync_status || 'never'
  const statusBadge =
    status === 'done' ? 'bg-green-500/15 text-green-500' :
    status === 'in_progress' || status === 'pending' ? 'bg-blue-500/15 text-blue-500 animate-pulse' :
    status === 'failed' ? 'bg-red-500/15 text-red-500' :
    'bg-[var(--bg-hover)] text-[var(--text-secondary)]'

  const statusLabel =
    status === 'done' ? t('sync.statusDone') :
    status === 'in_progress' || status === 'pending' ? t('sync.statusInProgress') :
    status === 'failed' ? t('sync.statusFailed') :
    t('sync.statusNever')

  const lang = i18n.language === 'en' ? 'en-US' : 'ru-RU'

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text)]">{t('sync.title')}</h3>
          <p className="text-xs text-[var(--text-secondary)]">{t('sync.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusBadge}`}>{statusLabel}</span>
          <button
            onClick={run}
            disabled={loading}
            className="px-3 py-1.5 text-sm text-white bg-[var(--accent)] rounded-lg hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            {loading ? t('sync.buttonLoading', { ticks }) : t('sync.button')}
          </button>
        </div>
      </div>

      {client.last_synced_at && (
        <div className="text-[11px] text-[var(--text-secondary)]">
          {t('sync.lastSynced', { when: new Date(client.last_synced_at).toLocaleString(lang) })}
        </div>
      )}

      {egrul && egrul.name_short && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] p-3 text-sm space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)] text-white font-semibold uppercase tracking-wider">{t('sync.badgeEgrul')}</span>
            <span className="font-medium text-[var(--text)]">{egrul.name_short}</span>
          </div>
          <div className="text-xs text-[var(--text-secondary)]">{egrul.name_full}</div>
          {egrul.director && (
            <div className="text-sm text-[var(--text)]">
              <b>{t('sync.director')}:</b> {egrul.director.full_name}
              <span className="text-xs text-[var(--text-secondary)] ml-1.5">· {egrul.director.position}</span>
            </div>
          )}
          {egrul.address && <div className="text-xs text-[var(--text-secondary)]"><b>{t('sync.address')}:</b> {egrul.address}</div>}
          {egrul.ogrn && <div className="text-xs text-[var(--text-secondary)] font-mono">ОГРН: {egrul.ogrn} · КПП: {egrul.kpp}</div>}
          {egrul.okved_main && (
            <div className="text-xs text-[var(--text-secondary)]">
              <b>{t('sync.okved')}:</b> {egrul.okved_main.code} — {egrul.okved_main.name}
            </div>
          )}
        </div>
      )}

      {financials && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] p-3 text-sm">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)] text-white font-semibold uppercase tracking-wider mr-2">{t('sync.badgeFinancials')}</span>
          {!financials.available ? (
            <span className="text-xs text-[var(--text-secondary)]">{t('sync.unavailable', { reason: financials.reason ?? '' })}</span>
          ) : !financials.found ? (
            <span className="text-xs text-[var(--text-secondary)]">{t('sync.noData')}</span>
          ) : (
            <div className="text-xs text-[var(--text-secondary)] mt-1 space-y-0.5">
              {financials.employees !== undefined && <div><b>{t('sync.employees')}:</b> {financials.employees}</div>}
              {financials.revenue_rub && <div><b>{t('sync.revenue')}:</b> {(financials.revenue_rub / 1_000_000).toFixed(1)}M ₽</div>}
            </div>
          )}
        </div>
      )}

      {hh.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] p-3 text-sm">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)] text-white font-semibold uppercase tracking-wider mr-2">{t('sync.badgeHh')}</span>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {hh.slice(0, 5).map((h) => (
              <a key={h.hh_id} href={`https://hh.ru/employer/${h.hh_id}`} target="_blank" rel="noreferrer"
                className="text-xs px-2 py-1 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)]">
                {h.name}{h.domain && ` · ${h.domain}`}
              </a>
            ))}
          </div>
        </div>
      )}

      {enriched && (enriched.name || enriched.contacts?.length) && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-hover)] p-3 text-sm">
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)] text-white font-semibold uppercase tracking-wider mr-2">{t('sync.badgeWebsite')}</span>
          {enriched.name && <span className="font-medium text-[var(--text)]">{enriched.name}</span>}
          {enriched.industry && <span className="text-xs text-[var(--text-secondary)] ml-2">{enriched.industry}</span>}
          {enriched.contacts && enriched.contacts.length > 0 && (
            <div className="text-xs text-[var(--text-secondary)] mt-1">{t('sync.contactsFound', { count: enriched.contacts.length })}</div>
          )}
        </div>
      )}

      {!egrul && !financials && hh.length === 0 && !enriched && status !== 'in_progress' && status !== 'pending' && (
        <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] rounded-lg p-3">
          {t('sync.empty')}
        </div>
      )}
    </div>
  )
}
