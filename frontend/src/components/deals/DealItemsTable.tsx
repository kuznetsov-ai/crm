import { useState, useEffect } from 'react'
import { dealsApi, type DealItem, type DealItemRateType } from '../../api/deals'
import { useCurrencyStore, formatAmount } from '../../stores/currencyStore'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditingRow {
  id: number | null  // null = new unsaved row
  role: string
  rate: string
  rate_type: DealItemRateType
  quantity: number
  months: number
  hours: number
  note: string
  order: number
}

const RATE_TYPE_LABELS: Record<DealItemRateType, string> = {
  monthly: 'Monthly',
  hourly: 'Hourly',
  fixed: 'Fixed',
}

const DEFAULT_NEW_ROW: Omit<EditingRow, 'id' | 'order'> = {
  role: '',
  rate: '',
  rate_type: 'monthly',
  quantity: 1,
  months: 1,
  hours: 0,
  note: '',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeSubtotal(row: Omit<EditingRow, 'id'>): number {
  const rate = parseFloat(row.rate) || 0
  const qty = row.quantity || 1
  if (row.rate_type === 'monthly') return rate * qty * (row.months || 1)
  if (row.rate_type === 'hourly') return rate * qty * (row.hours || 0)
  return rate * qty
}


// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  dealId: number
  /** Called after any mutation so parent can refresh deal.value_usd */
  onUpdate?: () => void
}

export default function DealItemsTable({ dealId, onUpdate }: Props) {
  const currency = useCurrencyStore(s => s.currency)
  const rate = useCurrencyStore(s => s.rate)
  /** Format a rate/subtotal that is stored in the workspace-currency units (no value_rub companion). */
  const fmtAmt = (value: string | number) => formatAmount(value, null, currency, rate)

  const [items, setItems] = useState<DealItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null | 'new'>(null)
  const [editRow, setEditRow] = useState<EditingRow | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    dealsApi.items.list(dealId)
      .then(setItems)
      .finally(() => setLoading(false))
  }, [dealId])

  const totalSubtotal = items.reduce((sum, i) => sum + parseFloat(i.subtotal || '0'), 0)

  // ── Start edit ──────────────────────────────────────────────────────────────

  const startEdit = (item: DealItem) => {
    setEditingId(item.id)
    setEditRow({
      id: item.id,
      role: item.role,
      rate: item.rate,
      rate_type: item.rate_type,
      quantity: item.quantity,
      months: item.months,
      hours: item.hours,
      note: item.note,
      order: item.order,
    })
  }

  const startNewRow = () => {
    setEditingId('new')
    setEditRow({
      id: null,
      ...DEFAULT_NEW_ROW,
      order: items.length,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditRow(null)
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const saveRow = async () => {
    if (!editRow) return
    setSaving(true)
    try {
      const payload = {
        role: editRow.role,
        rate: editRow.rate,
        rate_type: editRow.rate_type,
        quantity: editRow.quantity,
        months: editRow.months,
        hours: editRow.hours,
        note: editRow.note,
        order: editRow.order,
        ratecard_role: null,
      }
      if (editRow.id === null) {
        const created = await dealsApi.items.create(dealId, payload)
        setItems((prev) => [...prev, created])
      } else {
        const updated = await dealsApi.items.update(dealId, editRow.id, payload)
        setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      }
      cancelEdit()
      onUpdate?.()
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  const deleteItem = async (item: DealItem) => {
    if (!window.confirm('Delete this item?')) return
    await dealsApi.items.delete(dealId, item.id)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    onUpdate?.()
  }

  // ── Field helpers ────────────────────────────────────────────────────────────

  const patch = (field: keyof EditingRow, value: string | number) => {
    setEditRow((prev) => prev ? { ...prev, [field]: value } : prev)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-24">
        <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const showMonths = editRow?.rate_type === 'monthly'
  const showHours = editRow?.rate_type === 'hourly'

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
          Позиции
        </p>
        <p className="text-sm font-semibold text-[var(--accent)]">
          {fmtAmt(totalSubtotal)}
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-hover)]">
              <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] min-w-[140px]">
                Роль
              </th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] w-28">
                Ставка
              </th>
              <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] w-24">
                Тип
              </th>
              <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] w-16">
                Кол-во
              </th>
              <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] w-20">
                Мес/Ч
              </th>
              <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] w-32">
                Сумма
              </th>
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isEditing = editingId === item.id

              if (isEditing && editRow) {
                return (
                  <tr key={item.id} className="bg-[var(--bg-hover)] border-b border-[var(--border)]">
                    <td className="px-2 py-1.5">
                      <input
                        value={editRow.role}
                        onChange={(e) => patch('role', e.target.value)}
                        placeholder="Роль"
                        className="w-full rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-2 py-1 text-xs focus:outline-none focus:border-[var(--accent)]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        value={editRow.rate}
                        onChange={(e) => patch('rate', e.target.value)}
                        placeholder="0"
                        className="w-full rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-2 py-1 text-xs text-right focus:outline-none focus:border-[var(--accent)]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        value={editRow.rate_type}
                        onChange={(e) => patch('rate_type', e.target.value as DealItemRateType)}
                        className="w-full rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-2 py-1 text-xs focus:outline-none focus:border-[var(--accent)]"
                      >
                        <option value="monthly">Monthly</option>
                        <option value="hourly">Hourly</option>
                        <option value="fixed">Fixed</option>
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={1}
                        value={editRow.quantity}
                        onChange={(e) => patch('quantity', parseInt(e.target.value) || 1)}
                        className="w-full rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-2 py-1 text-xs text-center focus:outline-none focus:border-[var(--accent)]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      {showMonths && (
                        <input
                          type="number"
                          min={1}
                          value={editRow.months}
                          onChange={(e) => patch('months', parseInt(e.target.value) || 1)}
                          className="w-full rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-2 py-1 text-xs text-center focus:outline-none focus:border-[var(--accent)]"
                        />
                      )}
                      {showHours && (
                        <input
                          type="number"
                          min={0}
                          value={editRow.hours}
                          onChange={(e) => patch('hours', parseInt(e.target.value) || 0)}
                          className="w-full rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-2 py-1 text-xs text-center focus:outline-none focus:border-[var(--accent)]"
                        />
                      )}
                      {!showMonths && !showHours && (
                        <span className="text-[var(--text-secondary)] text-xs px-2">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium text-[var(--text)]">
                      {fmtAmt(computeSubtotal(editRow))}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={saveRow}
                          disabled={saving}
                          className="px-2 py-1 text-[10px] font-medium bg-[var(--accent)] text-white rounded hover:opacity-90 disabled:opacity-50"
                        >
                          {saving ? '...' : 'OK'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-2 py-1 text-[10px] font-medium border border-[var(--border)] rounded text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }

              const monthOrHours = item.rate_type === 'monthly'
                ? `${item.months}m`
                : item.rate_type === 'hourly'
                  ? `${item.hours}h`
                  : '—'

              return (
                <tr
                  key={item.id}
                  className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors group"
                >
                  <td className="px-3 py-2.5 text-[var(--text)] font-medium">{item.role}</td>
                  <td className="px-3 py-2.5 text-right text-[var(--text)]">
                    {fmtAmt(item.rate)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-hover)] text-[var(--text-secondary)]">
                      {RATE_TYPE_LABELS[item.rate_type]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-[var(--text)]">{item.quantity}</td>
                  <td className="px-3 py-2.5 text-center text-[var(--text-secondary)]">{monthOrHours}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[var(--text)]">
                    {fmtAmt(item.subtotal)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(item)}
                        className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]"
                        title="Edit"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteItem(item)}
                        className="p-1 rounded text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--bg-hover)]"
                        title="Delete"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/>
                          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}

            {/* New row form */}
            {editingId === 'new' && editRow && (
              <tr className="bg-[var(--bg-hover)] border-b border-[var(--border)]">
                <td className="px-2 py-1.5">
                  <input
                    autoFocus
                    value={editRow.role}
                    onChange={(e) => patch('role', e.target.value)}
                    placeholder="Роль"
                    className="w-full rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-2 py-1 text-xs focus:outline-none focus:border-[var(--accent)]"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    value={editRow.rate}
                    onChange={(e) => patch('rate', e.target.value)}
                    placeholder="0"
                    className="w-full rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-2 py-1 text-xs text-right focus:outline-none focus:border-[var(--accent)]"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={editRow.rate_type}
                    onChange={(e) => patch('rate_type', e.target.value as DealItemRateType)}
                    className="w-full rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-2 py-1 text-xs focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="hourly">Hourly</option>
                    <option value="fixed">Fixed</option>
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={1}
                    value={editRow.quantity}
                    onChange={(e) => patch('quantity', parseInt(e.target.value) || 1)}
                    className="w-full rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-2 py-1 text-xs text-center focus:outline-none focus:border-[var(--accent)]"
                  />
                </td>
                <td className="px-2 py-1.5">
                  {showMonths && (
                    <input
                      type="number"
                      min={1}
                      value={editRow.months}
                      onChange={(e) => patch('months', parseInt(e.target.value) || 1)}
                      className="w-full rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-2 py-1 text-xs text-center focus:outline-none focus:border-[var(--accent)]"
                    />
                  )}
                  {showHours && (
                    <input
                      type="number"
                      min={0}
                      value={editRow.hours}
                      onChange={(e) => patch('hours', parseInt(e.target.value) || 0)}
                      className="w-full rounded border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-2 py-1 text-xs text-center focus:outline-none focus:border-[var(--accent)]"
                    />
                  )}
                  {!showMonths && !showHours && (
                    <span className="text-[var(--text-secondary)] text-xs px-2">—</span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right font-medium text-[var(--text)]">
                  {fmtAmt(computeSubtotal(editRow))}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      onClick={saveRow}
                      disabled={saving || !editRow.role || !editRow.rate}
                      className="px-2 py-1 text-[10px] font-medium bg-[var(--accent)] text-white rounded hover:opacity-90 disabled:opacity-50"
                    >
                      {saving ? '...' : 'OK'}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-2 py-1 text-[10px] font-medium border border-[var(--border)] rounded text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty state */}
            {items.length === 0 && editingId !== 'new' && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-[var(--text-secondary)]">
                  Нет позиций. Нажмите «+ Добавить», чтобы начать.
                </td>
              </tr>
            )}
          </tbody>

          {/* Footer total */}
          {items.length > 0 && (
            <tfoot>
              <tr className="border-t border-[var(--border)] bg-[var(--bg-hover)]">
                <td colSpan={5} className="px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  Итого
                </td>
                <td className="px-3 py-2 text-right font-bold text-[var(--accent)]">
                  {fmtAmt(totalSubtotal)}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Add button */}
      {editingId !== 'new' && (
        <button
          onClick={startNewRow}
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--accent)] border border-dashed border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Добавить позицию
        </button>
      )}
    </div>
  )
}
