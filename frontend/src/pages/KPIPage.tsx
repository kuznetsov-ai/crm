import { useState, useEffect, useCallback } from 'react'
import api from '../api/client'
import {
  kpiApi,
  METRIC_LABELS,
  PERIOD_LABELS,
  type KPIMetric,
  type KPIPeriod,
  type KPISummaryItem,
  type KPITarget,
  type CreateKPITargetPayload,
} from '../api/kpi'
import type { UserProfile } from '../api/auth'
import { useCurrencyStore } from '../stores/currencyStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const METRICS: KPIMetric[] = ['deals_count', 'revenue_usd', 'new_leads', 'tasks_done', 'clients_added']
const PERIODS: KPIPeriod[] = ['day', 'week', 'month', 'quarter', 'year']

function getDefaultPeriodNumber(period: KPIPeriod): number {
  const now = new Date()
  if (period === 'month') return now.getMonth() + 1
  if (period === 'quarter') return Math.ceil((now.getMonth() + 1) / 3)
  if (period === 'week') {
    const start = new Date(now.getFullYear(), 0, 1)
    return Math.ceil(((now.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7)
  }
  if (period === 'day') {
    const start = new Date(now.getFullYear(), 0, 0)
    return Math.floor((now.getTime() - start.getTime()) / 86400000)
  }
  return 1 // year
}

function getPeriodMax(period: KPIPeriod): number {
  if (period === 'month') return 12
  if (period === 'quarter') return 4
  if (period === 'week') return 53
  if (period === 'day') return 366
  return 1
}

function getPeriodLabel(period: KPIPeriod): string {
  if (period === 'month') return 'Месяц (1-12)'
  if (period === 'quarter') return 'Квартал (1-4)'
  if (period === 'week') return 'Неделя (1-53)'
  if (period === 'day') return 'День (1-366)'
  return 'Период'
}

function getColorClass(pct: number): string {
  if (pct >= 100) return '#22c55e'  // green
  if (pct >= 50) return '#fd7448'   // orange accent
  return '#ef4444'                   // red
}

function formatValue(metric: KPIMetric, val: string, currencySymbol = '$'): string {
  const n = parseFloat(val)
  if (metric === 'revenue_usd') return `${currencySymbol}${n.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}

// ---------------------------------------------------------------------------
// Add Target Modal
// ---------------------------------------------------------------------------

interface ModalProps {
  users: UserProfile[]
  onClose: () => void
  onSaved: () => void
}

function AddTargetModal({ users, onClose, onSaved }: ModalProps) {
  const currentYear = new Date().getFullYear()
  const [form, setForm] = useState<CreateKPITargetPayload>({
    metric: 'deals_count',
    period: 'month',
    year: currentYear,
    period_number: new Date().getMonth() + 1,
    target_value: '',
    assigned_to_id: null,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handlePeriodChange = (p: KPIPeriod) => {
    setForm(f => ({ ...f, period: p, period_number: getDefaultPeriodNumber(p) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.target_value || parseFloat(form.target_value) <= 0) {
      setError('Укажите корректное целевое значение')
      return
    }
    setSaving(true)
    setError('')
    try {
      await kpiApi.createTarget(form)
      onSaved()
      onClose()
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: unknown } }
      const respData = anyErr?.response?.data
      if (respData && typeof respData === 'object') {
        const msgs = Object.values(respData as Record<string, string[]>).flat()
        setError(msgs.join(' ') || 'Ошибка сохранения')
      } else {
        setError('Ошибка сохранения')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Добавить KPI цель</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Metric */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Метрика
            </label>
            <select
              value={form.metric}
              onChange={e => setForm(f => ({ ...f, metric: e.target.value as KPIMetric }))}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              {METRICS.map(m => (
                <option key={m} value={m}>{METRIC_LABELS[m]}</option>
              ))}
            </select>
          </div>

          {/* Period */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Период
            </label>
            <div className="flex gap-1 flex-wrap">
              {PERIODS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePeriodChange(p)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{
                    background: form.period === p ? 'var(--accent)' : 'var(--bg)',
                    color: form.period === p ? '#fff' : 'var(--text-secondary)',
                    border: `1px solid ${form.period === p ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Year + Period number */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Год
              </label>
              <input
                type="number"
                value={form.year}
                onChange={e => setForm(f => ({ ...f, year: parseInt(e.target.value) || currentYear }))}
                min={2020}
                max={2099}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>
            {form.period !== 'year' && (
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {getPeriodLabel(form.period)}
                </label>
                <input
                  type="number"
                  value={form.period_number}
                  onChange={e => setForm(f => ({ ...f, period_number: parseInt(e.target.value) || 1 }))}
                  min={1}
                  max={getPeriodMax(form.period)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text)',
                  }}
                />
              </div>
            )}
          </div>

          {/* Target value */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Целевое значение
            </label>
            <input
              type="number"
              value={form.target_value}
              onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))}
              placeholder="100"
              min="0"
              step="any"
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
              required
            />
          </div>

          {/* Assigned to */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Сотрудник (пусто = компания)
            </label>
            <select
              value={form.assigned_to_id ?? ''}
              onChange={e => setForm(f => ({ ...f, assigned_to_id: e.target.value ? parseInt(e.target.value) : null }))}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              <option value="">— Уровень компании —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name ? `${u.first_name} ${u.last_name}`.trim() : u.email}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-opacity"
              style={{ background: 'var(--accent)', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KPICardProps {
  item: KPISummaryItem
  metric: KPIMetric
  onDelete?: (id: number) => void
  targetId?: number
}

function KPICard({ item, onDelete, targetId }: KPICardProps) {
  const currency = useCurrencyStore(s => s.currency)
  const currencySymbol = currency === 'RUB' ? '₽' : '$'
  const pct = Math.min(item.percentage, 100)
  const color = getColorClass(item.percentage)

  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-3 relative group"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
            {METRIC_LABELS[item.metric]}
          </p>
          {item.assigned_to_name && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {item.assigned_to_name}
            </p>
          )}
          {!item.assigned_to_name && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Компания
            </p>
          )}
        </div>
        {onDelete && targetId !== undefined && (
          <button
            onClick={() => onDelete(targetId)}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 flex items-center justify-center rounded text-xs"
            style={{ color: 'var(--danger)' }}
            title="Удалить цель"
          >
            ✕
          </button>
        )}
      </div>

      {/* Values */}
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          {formatValue(item.metric, item.actual_value, currencySymbol)}
        </span>
        <span className="text-sm mb-0.5" style={{ color: 'var(--text-secondary)' }}>
          / {formatValue(item.metric, item.target_value, currencySymbol)}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: '6px', background: 'var(--border)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>

      {/* Percentage */}
      <p className="text-sm font-semibold" style={{ color }}>
        {item.percentage}%
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main KPI Page
// ---------------------------------------------------------------------------

export default function KPIPage() {
  const currentYear = new Date().getFullYear()
  const [period, setPeriod] = useState<KPIPeriod>('month')
  const [year, setYear] = useState(currentYear)
  const [periodNumber, setPeriodNumber] = useState(getDefaultPeriodNumber('month'))
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)

  const [summary, setSummary] = useState<KPISummaryItem[]>([])
  const [targets, setTargets] = useState<KPITarget[]>([])
  const [users, setUsers] = useState<UserProfile[]>([])

  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)

  // Fetch users once
  useEffect(() => {
    api.get('/users/').then(r => {
      const data = r.data
      setUsers(Array.isArray(data) ? data : (data.results ?? []))
    }).catch(() => {})
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [summaryData, targetsData] = await Promise.all([
        kpiApi.getSummary({ period, year, period_number: periodNumber, user_id: selectedUserId }),
        kpiApi.listTargets(),
      ])
      setSummary(summaryData)
      setTargets(targetsData)
    } finally {
      setLoading(false)
    }
  }, [period, year, periodNumber, selectedUserId])

  useEffect(() => { loadData() }, [loadData])

  const handlePeriodChange = (p: KPIPeriod) => {
    setPeriod(p)
    setPeriodNumber(getDefaultPeriodNumber(p))
  }

  const handleDelete = async (targetId: number) => {
    if (!window.confirm('Удалить KPI цель?')) return
    await kpiApi.deleteTarget(targetId)
    loadData()
  }

  // Map summary items to their target id for delete
  const targetMap = new Map(targets.map(t => [
    `${t.assigned_to_id ?? 'null'}-${t.metric}-${t.period}-${t.year}-${t.period_number}`,
    t.id,
  ]))

  return (
    <div className="min-h-screen p-4 md:p-6" style={{ color: 'var(--text)' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>KPI</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Ключевые показатели эффективности
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 shrink-0"
          style={{ background: 'var(--accent)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Добавить цель
        </button>
      </div>

      {/* Filters */}
      <div
        className="rounded-xl p-4 mb-6 flex flex-col gap-4"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {/* Period pills */}
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(p => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className="px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
              style={{
                background: period === p ? 'var(--accent)' : 'var(--bg)',
                color: period === p ? '#fff' : 'var(--text-secondary)',
                border: `1px solid ${period === p ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>

        {/* Year + period number + employee filter */}
        <div className="flex flex-wrap gap-3 items-end">
          {/* Year */}
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Год</label>
            <input
              type="number"
              value={year}
              onChange={e => setYear(parseInt(e.target.value) || currentYear)}
              min={2020}
              max={2099}
              className="rounded-lg px-3 py-1.5 text-sm w-24"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
          </div>

          {/* Period number */}
          {period !== 'year' && (
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>
                {getPeriodLabel(period)}
              </label>
              <input
                type="number"
                value={periodNumber}
                onChange={e => setPeriodNumber(parseInt(e.target.value) || 1)}
                min={1}
                max={getPeriodMax(period)}
                className="rounded-lg px-3 py-1.5 text-sm w-24"
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>
          )}

          {/* Employee filter */}
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Сотрудник</label>
            <select
              value={selectedUserId ?? ''}
              onChange={e => setSelectedUserId(e.target.value ? parseInt(e.target.value) : null)}
              className="rounded-lg px-3 py-1.5 text-sm"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              <option value="">Все сотрудники</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.first_name ? `${u.first_name} ${u.last_name}`.trim() : u.email}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div
            className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : summary.length === 0 ? (
        <div
          className="rounded-xl p-12 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          <svg
            className="mx-auto mb-4"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--text-secondary)' }}
          >
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          <p className="text-sm font-medium mb-1" style={{ color: 'var(--text)' }}>Нет KPI целей</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Добавьте цели для выбранного периода и они появятся здесь
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: 'var(--accent)' }}
          >
            Добавить цель
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {summary.map(item => {
            const key = `${item.assigned_to_id ?? 'null'}-${item.metric}-${item.period}-${item.year}-${item.period_number}`
            const targetId = targetMap.get(key)
            return (
              <KPICard
                key={item.id}
                item={item}
                metric={item.metric}
                onDelete={handleDelete}
                targetId={targetId}
              />
            )
          })}
        </div>
      )}

      {/* Add modal */}
      {modalOpen && (
        <AddTargetModal
          users={users}
          onClose={() => setModalOpen(false)}
          onSaved={loadData}
        />
      )}
    </div>
  )
}
