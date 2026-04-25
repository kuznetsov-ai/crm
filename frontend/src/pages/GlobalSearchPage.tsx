import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import { useCurrencyStore } from '../stores/currencyStore'

// =============================================================================
// Types & constants
// =============================================================================

type Op = 'gte' | 'gt' | 'lte' | 'lt' | 'eq'
type DateRange = { from?: string; to?: string }
type NumberFilter = { op: Op; value?: number }

type ClientBlock = {
  enabled: boolean
  industry?: string
  country?: string
  company_size?: string
  budget_range?: string
  status?: string
  tech_stack_contains?: string
  has_contacts?: 'yes' | 'no' | ''
}

type DealsBlock = {
  enabled: boolean
  status?: string
  value_op?: NumberFilter
  assigned_to?: number
  close_range?: DateRange
  ending_within_days?: number
}

type TasksBlock = {
  enabled: boolean
  priority?: string
  status?: string
  assigned_to?: number
  overdue?: boolean
}

type RatesBlock = {
  enabled: boolean
  role?: string
  unit?: string
  bill_rate_op?: NumberFilter
}

type NotesBlock = {
  enabled: boolean
  kind?: string
  body_contains?: string
  date_range?: DateRange
  pinned_only?: boolean
}

interface SearchRow {
  id: number
  name: string
  industry: string
  country: string
  status: string
  company_size: string
  budget_range: string
  assigned_to: string | null
  open_deals: number
  won_deals: number
  won_usd: number
  rate_cards_count: number
  avg_bill_usd: number
  avg_cost_usd: number
  notes_count: number
}

interface SearchResponse {
  results: SearchRow[]
  count: number
  page: number
  page_size: number
  warnings: unknown[]
}

interface SchemaResponse {
  blocks: Record<string, { available: boolean; fields: string[] }>
  choices: {
    client_status: string[]
    deal_status: string[]
    task_status: string[]
    task_priority: string[]
    rate_role: string[]
    note_kind: string[]
  }
}

const OP_LABELS: Record<Op, string> = { gte: '≥', gt: '>', lte: '≤', lt: '<', eq: '=' }

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '200+']
const BUDGET_RANGES = ['small', 'medium', 'large', 'enterprise']

// =============================================================================
// Small controls
// =============================================================================

const inputCls =
  'w-full px-2 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]'

function LabeledField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{label}</span>
      {children}
    </label>
  )
}

function DateRangeField({ value, onChange }: { value?: DateRange; onChange: (v: DateRange) => void }) {
  const v = value || {}
  return (
    <div className="flex gap-2">
      <input type="date" value={v.from || ''} onChange={(e) => onChange({ ...v, from: e.target.value })} className={inputCls} />
      <input type="date" value={v.to || ''} onChange={(e) => onChange({ ...v, to: e.target.value })} className={inputCls} />
    </div>
  )
}

function OpValueField({ value, onChange, placeholder }: { value?: NumberFilter; onChange: (v: NumberFilter) => void; placeholder?: string }) {
  const v = value || { op: 'gte' as Op }
  return (
    <div className="flex gap-2">
      <select value={v.op} onChange={(e) => onChange({ ...v, op: e.target.value as Op })} className={`${inputCls} max-w-[70px]`}>
        {(['gte', 'gt', 'eq', 'lte', 'lt'] as Op[]).map((op) => <option key={op} value={op}>{OP_LABELS[op]}</option>)}
      </select>
      <input
        type="number"
        value={v.value ?? ''}
        onChange={(e) => onChange({ ...v, value: e.target.value ? Number(e.target.value) : undefined })}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  )
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors cursor-pointer"
      style={{ background: checked ? 'var(--accent)' : 'var(--bg-hover)' }}
      aria-pressed={checked}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform m-0.5 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

function Block({
  title,
  icon,
  enabled,
  expanded,
  onToggle,
  onExpand,
  activeCount,
  children,
}: {
  title: string
  icon: string
  enabled: boolean
  expanded: boolean
  onToggle: () => void
  onExpand: () => void
  activeCount?: number
  children?: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl border-2 transition-all duration-200 bg-[var(--bg-card)]"
      style={{ borderColor: enabled ? 'var(--accent)' : 'var(--border)' }}
    >
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none" onClick={onExpand}>
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
          style={{ background: enabled ? 'var(--accent)' : 'var(--bg-hover)', color: enabled ? '#fff' : 'var(--text-secondary)' }}
        >
          <span className="text-base">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text)]">{title}</span>
            {activeCount !== undefined && activeCount > 0 && (
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-white" style={{ background: 'var(--accent)' }}>{activeCount}</span>
            )}
          </div>
        </div>
        <ToggleSwitch checked={enabled} onChange={() => { onToggle() }} />
        <span className="text-[var(--text-secondary)] text-xs">{expanded ? '▼' : '▶'}</span>
      </div>
      {expanded && children && (
        <div className="px-4 pb-4 border-t border-[var(--border)] pt-3">{children}</div>
      )}
    </div>
  )
}

// =============================================================================
// Main page
// =============================================================================

export default function GlobalSearchPage() {
  const currency = useCurrencyStore(s => s.currency)
  const rate = useCurrencyStore(s => s.rate)
  const currencySymbol = currency === 'RUB' ? '₽' : '$'
  const [schema, setSchema] = useState<SchemaResponse | null>(null)
  const [response, setResponse] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['client']))

  const [client, setClient] = useState<ClientBlock>({ enabled: false })
  const [deals, setDeals] = useState<DealsBlock>({ enabled: false })
  const [tasks, setTasks] = useState<TasksBlock>({ enabled: false })
  const [rates, setRates] = useState<RatesBlock>({ enabled: false })
  const [notes, setNotes] = useState<NotesBlock>({ enabled: false })

  useEffect(() => {
    api.get<SchemaResponse>('/dashboard/search/schema/')
      .then((res) => setSchema(res.data))
      .catch(() => setSchema(null))
  }, [])

  const toggleExpand = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }, [])

  const countBlockFields = (obj: Record<string, unknown>): number => {
    return Object.entries(obj).filter(([k, v]) => {
      if (k === 'enabled') return false
      if (v === undefined || v === null || v === '' || v === false) return false
      if (Array.isArray(v) && v.length === 0) return false
      if (typeof v === 'object') {
        const values = Object.values(v as Record<string, unknown>)
        return values.some((x) => x !== undefined && x !== '' && x !== null)
      }
      return true
    }).length
  }

  const activeBlockCount = useMemo(
    () => [client, deals, tasks, rates, notes].filter((b) => b.enabled).length,
    [client, deals, tasks, rates, notes],
  )

  const buildPayload = useCallback(() => {
    const blocks: Record<string, Record<string, unknown>> = {}
    if (client.enabled) {
      const c: Record<string, unknown> = {}
      if (client.industry) c.industry = client.industry
      if (client.country) c.country = client.country
      if (client.company_size) c.company_size = client.company_size
      if (client.budget_range) c.budget_range = client.budget_range
      if (client.status) c.status = client.status
      if (client.tech_stack_contains) c.tech_stack_contains = client.tech_stack_contains
      if (client.has_contacts) c.has_contacts = client.has_contacts
      blocks.client = c
    }
    if (deals.enabled) {
      const d: Record<string, unknown> = {}
      if (deals.status) d.status = deals.status
      if (deals.value_op?.value !== undefined) d.value_op = deals.value_op
      if (deals.assigned_to) d.assigned_to = deals.assigned_to
      if (deals.close_range?.from || deals.close_range?.to) d.close_range = deals.close_range
      if (deals.ending_within_days) d.ending_within_days = deals.ending_within_days
      blocks.deals = d
    }
    if (tasks.enabled) {
      const t: Record<string, unknown> = {}
      if (tasks.priority) t.priority = tasks.priority
      if (tasks.status) t.status = tasks.status
      if (tasks.overdue) t.overdue = true
      blocks.tasks = t
    }
    if (rates.enabled) {
      const r: Record<string, unknown> = {}
      if (rates.role) r.role = rates.role
      if (rates.unit) r.unit = rates.unit
      if (rates.bill_rate_op?.value !== undefined) r.bill_rate_op = rates.bill_rate_op
      blocks.rate_cards = r
    }
    if (notes.enabled) {
      const n: Record<string, unknown> = {}
      if (notes.kind) n.kind = notes.kind
      if (notes.body_contains) n.body_contains = notes.body_contains
      if (notes.date_range?.from || notes.date_range?.to) n.date_range = notes.date_range
      if (notes.pinned_only) n.pinned_only = true
      blocks.notes = n
    }
    return { blocks, page: currentPage, page_size: 20 }
  }, [client, deals, tasks, rates, notes, currentPage])

  const runSearch = useCallback(async (pageOverride?: number) => {
    setLoading(true)
    setErrorText('')
    try {
      const payload = buildPayload()
      if (pageOverride !== undefined) payload.page = pageOverride
      else payload.page = 1
      if (!Object.keys(payload.blocks).length) {
        setErrorText('Выберите хотя бы один блок')
        setResponse(null)
        return
      }
      if (pageOverride === undefined) setCurrentPage(1)
      const res = await api.post<SearchResponse>('/dashboard/search/', payload)
      setResponse(res.data)
    } catch (err) {
      setErrorText(`Ошибка: ${(err as Error).message}`)
    } finally {
      setLoading(false)
    }
  }, [buildPayload])

  const reset = () => {
    setClient({ enabled: false })
    setDeals({ enabled: false })
    setTasks({ enabled: false })
    setRates({ enabled: false })
    setNotes({ enabled: false })
    setResponse(null)
    setErrorText('')
    setCurrentPage(1)
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: 'var(--accent)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">Расширенный поиск</h1>
            <p className="text-xs text-[var(--text-secondary)]">Комбинируй блоки — клиенты, сделки, задачи, ставки, заметки</p>
          </div>
        </div>
        {activeBlockCount > 0 && (
          <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
            Активных блоков: {activeBlockCount}
          </div>
        )}
      </header>

      {errorText && (
        <div className="rounded-xl p-3 text-sm border bg-red-500/5 border-red-500/30 text-red-500">{errorText}</div>
      )}

      {/* Blocks */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Client */}
        <Block
          title="Клиент"
          icon="🏢"
          enabled={client.enabled}
          expanded={expanded.has('client')}
          onToggle={() => setClient((p) => ({ ...p, enabled: !p.enabled }))}
          onExpand={() => toggleExpand('client')}
          activeCount={countBlockFields(client)}
        >
          <div className="grid grid-cols-2 gap-3">
            <LabeledField label="Индустрия содержит">
              <input value={client.industry ?? ''} onChange={(e) => setClient((p) => ({ ...p, industry: e.target.value }))} className={inputCls} placeholder="Retail, Finance..." />
            </LabeledField>
            <LabeledField label="Страна содержит">
              <input value={client.country ?? ''} onChange={(e) => setClient((p) => ({ ...p, country: e.target.value }))} className={inputCls} placeholder="Italy" />
            </LabeledField>
            <LabeledField label="Размер компании">
              <select value={client.company_size ?? ''} onChange={(e) => setClient((p) => ({ ...p, company_size: e.target.value }))} className={inputCls}>
                <option value="">—</option>
                {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Бюджет">
              <select value={client.budget_range ?? ''} onChange={(e) => setClient((p) => ({ ...p, budget_range: e.target.value }))} className={inputCls}>
                <option value="">—</option>
                {BUDGET_RANGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Статус">
              <select value={client.status ?? ''} onChange={(e) => setClient((p) => ({ ...p, status: e.target.value }))} className={inputCls}>
                <option value="">—</option>
                {schema?.choices.client_status.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Стек содержит">
              <input value={client.tech_stack_contains ?? ''} onChange={(e) => setClient((p) => ({ ...p, tech_stack_contains: e.target.value }))} className={inputCls} placeholder="Java" />
            </LabeledField>
            <LabeledField label="Есть контакты">
              <select value={client.has_contacts ?? ''} onChange={(e) => setClient((p) => ({ ...p, has_contacts: e.target.value as 'yes' | 'no' | '' }))} className={inputCls}>
                <option value="">—</option>
                <option value="yes">Да</option>
                <option value="no">Нет</option>
              </select>
            </LabeledField>
          </div>
        </Block>

        {/* Deals */}
        <Block
          title="Сделки"
          icon="💼"
          enabled={deals.enabled}
          expanded={expanded.has('deals')}
          onToggle={() => setDeals((p) => ({ ...p, enabled: !p.enabled }))}
          onExpand={() => toggleExpand('deals')}
          activeCount={countBlockFields(deals)}
        >
          <div className="grid grid-cols-2 gap-3">
            <LabeledField label="Статус сделки">
              <select value={deals.status ?? ''} onChange={(e) => setDeals((p) => ({ ...p, status: e.target.value }))} className={inputCls}>
                <option value="">—</option>
                {schema?.choices.deal_status.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Сумма сделки USD">
              <OpValueField value={deals.value_op} onChange={(v) => setDeals((p) => ({ ...p, value_op: v }))} placeholder="50000" />
            </LabeledField>
            <LabeledField label="Expected close (диапазон)">
              <DateRangeField value={deals.close_range} onChange={(v) => setDeals((p) => ({ ...p, close_range: v }))} />
            </LabeledField>
            <LabeledField label="Истекает за N дней">
              <input type="number" value={deals.ending_within_days ?? ''} onChange={(e) => setDeals((p) => ({ ...p, ending_within_days: e.target.value ? Number(e.target.value) : undefined }))} className={inputCls} placeholder="60" />
            </LabeledField>
          </div>
        </Block>

        {/* Tasks */}
        <Block
          title="Задачи"
          icon="✅"
          enabled={tasks.enabled}
          expanded={expanded.has('tasks')}
          onToggle={() => setTasks((p) => ({ ...p, enabled: !p.enabled }))}
          onExpand={() => toggleExpand('tasks')}
          activeCount={countBlockFields(tasks)}
        >
          <div className="grid grid-cols-2 gap-3">
            <LabeledField label="Приоритет">
              <select value={tasks.priority ?? ''} onChange={(e) => setTasks((p) => ({ ...p, priority: e.target.value }))} className={inputCls}>
                <option value="">—</option>
                {schema?.choices.task_priority.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Статус">
              <select value={tasks.status ?? ''} onChange={(e) => setTasks((p) => ({ ...p, status: e.target.value }))} className={inputCls}>
                <option value="">—</option>
                {schema?.choices.task_status.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Только просроченные">
              <label className="flex items-center gap-2 text-sm text-[var(--text)] mt-1">
                <input type="checkbox" checked={!!tasks.overdue} onChange={(e) => setTasks((p) => ({ ...p, overdue: e.target.checked }))} />
                Overdue
              </label>
            </LabeledField>
          </div>
        </Block>

        {/* Rate cards */}
        <Block
          title="Ставки"
          icon="💰"
          enabled={rates.enabled}
          expanded={expanded.has('rates')}
          onToggle={() => setRates((p) => ({ ...p, enabled: !p.enabled }))}
          onExpand={() => toggleExpand('rates')}
          activeCount={countBlockFields(rates)}
        >
          <div className="grid grid-cols-2 gap-3">
            <LabeledField label="Роль">
              <select value={rates.role ?? ''} onChange={(e) => setRates((p) => ({ ...p, role: e.target.value }))} className={inputCls}>
                <option value="">—</option>
                {schema?.choices.rate_role.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </LabeledField>
            <LabeledField label="Единица">
              <select value={rates.unit ?? ''} onChange={(e) => setRates((p) => ({ ...p, unit: e.target.value }))} className={inputCls}>
                <option value="">—</option>
                <option value="monthly">В месяц</option>
                <option value="hourly">В час</option>
              </select>
            </LabeledField>
            <LabeledField label="Bill rate USD">
              <OpValueField value={rates.bill_rate_op} onChange={(v) => setRates((p) => ({ ...p, bill_rate_op: v }))} placeholder="5000" />
            </LabeledField>
          </div>
        </Block>

        {/* Notes */}
        <div className="lg:col-span-2">
          <Block
            title="Заметки / База знаний"
            icon="📝"
            enabled={notes.enabled}
            expanded={expanded.has('notes')}
            onToggle={() => setNotes((p) => ({ ...p, enabled: !p.enabled }))}
            onExpand={() => toggleExpand('notes')}
            activeCount={countBlockFields(notes)}
          >
            <div className="grid grid-cols-2 gap-3">
              <LabeledField label="Тип">
                <select value={notes.kind ?? ''} onChange={(e) => setNotes((p) => ({ ...p, kind: e.target.value }))} className={inputCls}>
                  <option value="">—</option>
                  {schema?.choices.note_kind.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </LabeledField>
              <LabeledField label="Дата (диапазон)">
                <DateRangeField value={notes.date_range} onChange={(v) => setNotes((p) => ({ ...p, date_range: v }))} />
              </LabeledField>
              <LabeledField label="Содержит текст">
                <input value={notes.body_contains ?? ''} onChange={(e) => setNotes((p) => ({ ...p, body_contains: e.target.value }))} className={inputCls} placeholder="bench, rolloff..." />
              </LabeledField>
              <LabeledField label="Только закреплённые">
                <label className="flex items-center gap-2 text-sm text-[var(--text)] mt-1">
                  <input type="checkbox" checked={!!notes.pinned_only} onChange={(e) => setNotes((p) => ({ ...p, pinned_only: e.target.checked }))} />
                  pinned
                </label>
              </LabeledField>
            </div>
          </Block>
        </div>
      </section>

      {/* Results */}
      {response && (
        <section className="mt-3 rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--text)]">Результатов: {response.count}</h2>
            <span className="text-xs text-[var(--text-secondary)]">
              Стр. {response.page} из {Math.max(1, Math.ceil(response.count / response.page_size))}
            </span>
          </div>
          {response.results.length === 0 ? (
            <div className="p-8 text-center text-sm text-[var(--text-secondary)]">Ничего не найдено</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-hover)]">
                  <tr>
                    {['Клиент', 'Индустрия', 'Страна', 'Статус', 'Открытых сделок', 'Выиграно', 'USD won', 'Ставки', 'Avg bill', 'Заметки'].map((h) => (
                      <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] px-3 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {response.results.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">
                        <Link to={`/clients/${r.id}`} className="font-medium text-[var(--accent)] hover:underline">{r.name}</Link>
                      </td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">{r.industry || '—'}</td>
                      <td className="px-3 py-2 text-[var(--text-secondary)]">{r.country || '—'}</td>
                      <td className="px-3 py-2 text-[var(--text)]">{r.status}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">{r.open_deals || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">{r.won_deals || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--text)]">{currencySymbol}{(((currency === 'RUB' && rate) ? r.won_usd * rate : r.won_usd) / 1000).toFixed(0)}K</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{r.rate_cards_count || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{r.avg_bill_usd ? `${currencySymbol}${((currency === 'RUB' && rate) ? r.avg_bill_usd * rate : r.avg_bill_usd).toFixed(0)}` : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[var(--text-secondary)]">{r.notes_count || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {/* Pagination */}
          {response.count > response.page_size && (
            <div className="flex items-center justify-center gap-2 p-3 border-t border-[var(--border)]">
              <button
                onClick={() => runSearch(response.page - 1)}
                disabled={response.page <= 1 || loading}
                className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
              >← Пред</button>
              <span className="text-xs text-[var(--text-secondary)]">
                {response.page} / {Math.max(1, Math.ceil(response.count / response.page_size))}
              </span>
              <button
                onClick={() => runSearch(response.page + 1)}
                disabled={response.page * response.page_size >= response.count || loading}
                className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
              >След →</button>
            </div>
          )}
        </section>
      )}

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-card)] border-t border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="text-xs text-[var(--text-secondary)]">
            {activeBlockCount > 0 ? `Блоков: ${activeBlockCount}` : 'Активируйте блоки для поиска'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >Сбросить</button>
            <button
              onClick={() => runSearch()}
              disabled={loading || activeBlockCount === 0}
              className="px-5 py-2 text-sm rounded-lg text-white bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
            >{loading ? 'Поиск...' : 'Искать'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
