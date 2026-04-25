import { useTranslation } from 'react-i18next'
import { clientsApi } from '../../api/clients'
import type { Client } from '../../api/clients'

interface Props {
  selectedIds: number[]
  onClear: () => void
  onReload: () => void
}

const STATUS_OPTIONS: Client['status'][] = ['lead', 'prospect', 'active', 'paused', 'churned']

export default function BulkActionBar({ selectedIds, onClear, onReload }: Props) {
  const { t } = useTranslation()
  if (selectedIds.length === 0) return null

  const setStatus = async (status: Client['status']) => {
    await clientsApi.bulk('set_status', selectedIds, { status })
    onClear()
    onReload()
  }

  const del = async () => {
    if (!window.confirm(t('bulk.deleteConfirm', { count: selectedIds.length }))) return
    await clientsApi.bulk('delete', selectedIds)
    onClear()
    onReload()
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl rounded-xl px-4 py-3 flex items-center gap-3">
      <span className="text-sm font-medium text-[var(--text)]">{t('bulk.selected', { count: selectedIds.length })}</span>
      <div className="h-5 w-px bg-[var(--border)]" />
      <label className="text-xs text-[var(--text-secondary)]">{t('createClient.status')}:</label>
      <select
        onChange={(e) => e.target.value && setStatus(e.target.value as Client['status'])}
        defaultValue=""
        className="text-sm px-2 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
      >
        <option value="" disabled>{t('bulk.assign')}</option>
        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <button
        onClick={del}
        className="px-3 py-1.5 text-sm rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
      >{t('bulk.delete')}</button>
      <button
        onClick={onClear}
        className="px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors"
      >{t('bulk.cancel')}</button>
    </div>
  )
}
