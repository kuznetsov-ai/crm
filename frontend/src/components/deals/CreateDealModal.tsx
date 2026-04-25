import { useEffect, useState } from 'react'
import { dealsApi, DEAL_STATUSES, DEAL_STATUS_LABELS, type Deal } from '../../api/deals'
import { clientsApi, type ClientListItem } from '../../api/clients'
import { useCurrencyStore } from '../../stores/currencyStore'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (deal: Deal) => void
  presetClientId?: number
}

export default function CreateDealModal({ open, onClose, onCreated, presetClientId }: Props) {
  const currency = useCurrencyStore(s => s.currency)
  const currencySymbol = currency === 'RUB' ? '₽' : '$'
  const [clients, setClients] = useState<ClientListItem[]>([])
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState<number | ''>('')
  const [status, setStatus] = useState<Deal['status']>('new_lead')
  const [valueUsd, setValueUsd] = useState('')
  const [probability, setProbability] = useState<number | ''>(50)
  const [teamSize, setTeamSize] = useState<number | ''>(1)
  const [expectedClose, setExpectedClose] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    clientsApi.list({ page_size: '200' }).then((r) => setClients(r.results))
    if (presetClientId) setClientId(presetClientId)
  }, [open, presetClientId])

  useEffect(() => {
    if (!open) {
      setTitle(''); setClientId(''); setStatus('new_lead'); setValueUsd('')
      setProbability(50); setTeamSize(1); setExpectedClose(''); setDescription('')
      setError('')
    }
  }, [open])

  const canSubmit = !!title.trim() && !!clientId && !saving

  const submit = async () => {
    setSaving(true); setError('')
    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        client_id: clientId,
        status,
        value_usd: valueUsd || '0',
        probability: probability || 0,
        team_size_needed: teamSize || 1,
        description,
      }
      if (expectedClose) payload.expected_close_date = expectedClose
      const created = await dealsApi.create(payload)
      onCreated(created)
    } catch (err) {
      const msg = (err as { response?: { data?: unknown } })?.response?.data
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const inputCls = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)]'
  const labelCls = 'block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text)]">Новая сделка</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: 'auto' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          <div>
            <label className={labelCls}>Название *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="Backend Team — Q2 Augmentation" />
          </div>
          <div>
            <label className={labelCls}>Клиент *</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : '')} className={inputCls}>
              <option value="">— выберите клиента —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Статус</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as Deal['status'])} className={inputCls}>
                {DEAL_STATUSES.map((s) => <option key={s} value={s}>{DEAL_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Сумма ({currency})</label>
              <input type="number" value={valueUsd} onChange={(e) => setValueUsd(e.target.value)} className={inputCls} placeholder={currencySymbol === '₽' ? '3500000' : '50000'} />
            </div>
            <div>
              <label className={labelCls}>Вероятность %</label>
              <input type="number" min={0} max={100} value={probability} onChange={(e) => setProbability(e.target.value ? Number(e.target.value) : '')} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Размер команды</label>
              <input type="number" min={1} value={teamSize} onChange={(e) => setTeamSize(e.target.value ? Number(e.target.value) : '')} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Ожидаемая дата закрытия</label>
              <input type="date" value={expectedClose} onChange={(e) => setExpectedClose(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Описание</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} resize-y`} placeholder="Короткое описание, скоуп, ключевые требования..." />
          </div>
          {error && <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg p-2 break-words">{error}</div>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">Отмена</button>
          <button onClick={submit} disabled={!canSubmit} className="px-4 py-1.5 text-sm text-white bg-[var(--accent)] rounded-lg hover:opacity-90 disabled:opacity-50">
            {saving ? 'Создаём...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}
