import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useTranslation } from 'react-i18next'
import { dealsApi, type Deal, DEAL_STATUSES, DEAL_STATUS_LABELS } from '../api/deals'
import type { PaginatedResponse } from '../api/clients'
import KanbanColumn from '../components/deals/KanbanColumn'
import CreateDealModal from '../components/deals/CreateDealModal'
import { useCurrencyStore, formatAmount } from '../stores/currencyStore'
import LostReasonModal from '../components/deals/LostReasonModal'
import PipelineSwitcher from '../components/deals/PipelineSwitcher'
import { usePipelinesStore } from '../stores/usePipelinesStore'

type Board = Record<string, Deal[]>
type View = 'board' | 'list' | 'renewals'

const RENEWAL_WINDOW_DAYS = 60

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const target = new Date(dateStr)
  if (isNaN(target.getTime())) return null
  const now = new Date()
  const ms = target.getTime() - now.getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

const PAGE_SIZES = [20, 50, 100] as const

const STATUS_COLORS: Record<Deal['status'], string> = {
  new_lead: 'bg-blue-100 text-blue-700',
  discovery: 'bg-purple-100 text-purple-700',
  proposal: 'bg-yellow-100 text-yellow-700',
  negotiation: 'bg-orange-100 text-orange-700',
  signed: 'bg-green-100 text-green-700',
  active: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-gray-100 text-gray-600',
  lost: 'bg-red-100 text-red-600',
}

function useFormatDealValue() {
  const currency = useCurrencyStore(s => s.currency)
  const rate = useCurrencyStore(s => s.rate)
  return (deal: Pick<Deal, 'value_usd'> & { value_rub?: string | null }) =>
    formatAmount(deal.value_usd, deal.value_rub, currency, rate)
}


function formatDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function DealsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const formatDeal = useFormatDealValue()

  // ── Pipeline selector ────────────────────────────────────
  const { currentId: currentPipelineId } = usePipelinesStore()

  // ── Board state ──────────────────────────────────────────
  const [board, setBoard] = useState<Board>({})
  const [boardLoading, setBoardLoading] = useState(true)
  const [draggingDeal, setDraggingDeal] = useState<Deal | null>(null)
  const savedBoard = useRef<Board>({})
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // ── View toggle ──────────────────────────────────────────
  const [view, setView] = useState<View>('board')

  // ── List state ───────────────────────────────────────────
  const [listData, setListData] = useState<PaginatedResponse<Deal> | null>(null)
  const [listPage, setListPage] = useState(1)
  const [listPageSize, setListPageSize] = useState<20 | 50 | 100>(20)
  const [listFetching, setListFetching] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    ordering: '-created_at',
  })

  // ── Renewals state ───────────────────────────────────────
  const [renewals, setRenewals] = useState<Deal[]>([])
  const [renewalsLoading, setRenewalsLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  // ── Lost reason modal ────────────────────────────────────
  const [lostReasonPending, setLostReasonPending] = useState<{
    dealId: number
    toStatus: string
    boardSnapshot: Board
  } | null>(null)

  const loadRenewals = useCallback(async () => {
    setRenewalsLoading(true)
    try {
      // Active deals — candidates for renewal, client-side filter by end_date proximity.
      const [active, signed] = await Promise.all([
        dealsApi.list({ status: 'active', page_size: '200' }),
        dealsApi.list({ status: 'signed', page_size: '200' }),
      ])
      const all = [...active.results, ...signed.results]
      const upcoming = all
        .map((d) => ({ d, days: daysUntil(d.end_date) }))
        .filter((x) => x.days !== null && x.days <= RENEWAL_WINDOW_DAYS)
        .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
        .map((x) => x.d)
      setRenewals(upcoming)
    } finally {
      setRenewalsLoading(false)
    }
  }, [])

  // ── Board load ───────────────────────────────────────────
  const loadBoard = useCallback(async () => {
    setBoardLoading(true)
    try {
      const data = await dealsApi.list({ page_size: '200' })
      const grouped: Board = {}
      DEAL_STATUSES.forEach((s) => { grouped[s] = [] })
      data.results.forEach((d) => { (grouped[d.status] ??= []).push(d) })
      Object.keys(grouped).forEach((s) => { grouped[s].sort((a, b) => a.order - b.order) })
      setBoard(grouped)
    } finally { setBoardLoading(false) }
  }, [])

  // ── List load ────────────────────────────────────────────
  const loadList = useCallback(() => {
    setListFetching(true)
    const params: Record<string, string> = {
      page: String(listPage),
      page_size: String(listPageSize),
      ordering: filters.ordering,
    }
    if (filters.search) params.search = filters.search
    if (filters.status) params.status = filters.status
    dealsApi.list(params)
      .then(setListData)
      .finally(() => setListFetching(false))
  }, [listPage, listPageSize, filters])

  useEffect(() => {
    if (view === 'board') loadBoard()
    if (view === 'renewals') loadRenewals()
  }, [view, loadBoard])

  useEffect(() => {
    if (view === 'list') loadList()
  }, [view, loadList])

  // ── Drag & drop ──────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const id = Number(event.active.id)
    for (const deals of Object.values(board)) {
      const found = deals.find(d => d.id === id)
      if (found) { setDraggingDeal(found); break }
    }
    // Snapshot board before drag starts (for API call on end)
    savedBoard.current = JSON.parse(JSON.stringify(board))
  }

  // Live board update while dragging — makes cards in target column move apart
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = Number(active.id)
    const overId = String(over.id)

    // Find source column
    let fromStatus = ''
    for (const [s, deals] of Object.entries(board)) {
      if (deals.find(d => d.id === activeId)) { fromStatus = s; break }
    }
    if (!fromStatus) return

    // Find target column (over a card or over a column droppable)
    const toStatus = DEAL_STATUSES.includes(overId as Deal['status'])
      ? overId
      : (() => {
          for (const [s, deals] of Object.entries(board)) {
            if (deals.find(d => d.id === Number(overId))) return s
          }
          return fromStatus
        })()

    if (fromStatus === toStatus) {
      // Same column reorder — dnd-kit SortableContext handles this automatically
      return
    }

    // Cross-column: move card to target position live
    setBoard(prev => {
      const next = { ...prev }
      const moving = next[fromStatus].find(d => d.id === activeId)
      if (!moving) return prev
      next[fromStatus] = next[fromStatus].filter(d => d.id !== activeId)
      const toCol = [...(next[toStatus] ?? [])]
      const insertAt = toCol.findIndex(d => d.id === Number(overId))
      const updated = { ...moving, status: toStatus as Deal['status'] }
      insertAt >= 0 ? toCol.splice(insertAt, 0, updated) : toCol.push(updated)
      next[toStatus] = toCol
      return next
    })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingDeal(null)
    const { active, over } = event
    if (!over) {
      // Cancelled — restore
      setBoard(savedBoard.current)
      return
    }
    const activeId = Number(active.id)
    const overId = String(over.id)

    // Find where card ended up (board already updated by onDragOver)
    let toStatus = ''
    for (const [s, deals] of Object.entries(board)) {
      if (deals.find(d => d.id === activeId)) { toStatus = s; break }
    }
    if (!toStatus) return

    // Find original status from snapshot
    let fromStatus = ''
    for (const [s, deals] of Object.entries(savedBoard.current)) {
      if (deals.find(d => d.id === activeId)) { fromStatus = s; break }
    }

    // Handle same-column reorder (onDragOver didn't handle it)
    if (fromStatus === toStatus) {
      const col = [...board[toStatus]]
      const oi = col.findIndex(d => d.id === activeId)
      const ni = col.findIndex(d => d.id === Number(overId))
      if (oi !== ni && ni >= 0) {
        const reordered = arrayMove(col, oi, ni)
        setBoard(prev => ({ ...prev, [toStatus]: reordered }))
        try {
          await dealsApi.reorder(reordered.map((d, i) => ({ id: d.id, order: i })))
        } catch { loadBoard() }
      }
      return
    }

    // Cross-column: board already correct from onDragOver, just save to API
    // Intercept moves to "lost" column — ask for lost_reason first
    if (toStatus === 'lost') {
      // Check if this deal already has a lost_reason
      const movingDeal = board[toStatus].find(d => d.id === activeId)
      if (!movingDeal?.lost_reason) {
        // Show modal before committing the PATCH
        setLostReasonPending({ dealId: activeId, toStatus, boardSnapshot: savedBoard.current })
        return
      }
    }

    try {
      await dealsApi.update(activeId, { status: toStatus as Deal['status'] })
      const reorder = board[toStatus].map((d, i) => ({ id: d.id, order: i }))
      await dealsApi.reorder(reorder)
    } catch { loadBoard() }
  }

  // ── Lost reason modal handlers ───────────────────────────
  async function handleLostReasonSubmit(lostReasonId: number, comment: string) {
    if (!lostReasonPending) return
    const { dealId, toStatus } = lostReasonPending
    setLostReasonPending(null)
    try {
      await dealsApi.update(dealId, {
        status: toStatus as Deal['status'],
        lost_reason: lostReasonId,
        lost_comment: comment,
      } as any)
      const reorder = board[toStatus].map((d, i) => ({ id: d.id, order: i }))
      await dealsApi.reorder(reorder)
      loadBoard()
    } catch { loadBoard() }
  }

  function handleLostReasonCancel() {
    if (lostReasonPending) {
      setBoard(lostReasonPending.boardSnapshot)
    }
    setLostReasonPending(null)
  }

  // ── List helpers ─────────────────────────────────────────
  const totalPages = listData ? Math.max(1, Math.ceil(listData.count / listPageSize)) : 1
  const listFrom = listData && listData.count > 0 ? (listPage - 1) * listPageSize + 1 : 0
  const listTo = listData ? Math.min(listPage * listPageSize, listData.count) : 0
  const activeFiltersCount = [filters.search, filters.status].filter(Boolean).length

  const resetFilters = () => {
    setFilters({ search: '', status: '', ordering: '-created_at' })
    setListPage(1)
  }

  const setFilter = (key: keyof typeof filters, val: string) => {
    setFilters((f) => ({ ...f, [key]: val }))
    setListPage(1)
  }

  // ── UI ───────────────────────────────────────────────────
  const inputCls = 'rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-sm px-3 py-2 outline-none focus:border-[var(--accent)] transition-colors'

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">{t('nav.deals')}</h1>
          {view === 'list' && listData != null && (
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{listData.count} {t('deals.records')}</p>
          )}
        </div>
        <PipelineSwitcher />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="bg-[var(--accent)] text-white text-sm font-medium px-4 py-2 rounded-[var(--radius-md)] hover:opacity-90 transition-opacity"
        >
          + {t('deals.add')}
        </button>
        <CreateDealModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(d) => {
            setCreateOpen(false)
            if (view === 'board') loadBoard(); else if (view === 'list') loadList(); else if (view === 'renewals') loadRenewals()
            navigate(`/deals/${d.id}`)
          }}
        />

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {view === 'list' && (
            <>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilter('search', e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadList()}
                placeholder={`${t('common.search')} (Enter)`}
                className={`${inputCls} w-48`}
              />
              <button
                type="button"
                onClick={() => setShowFilters((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showFilters
                    ? 'bg-[var(--accent)] text-white'
                    : 'border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 12h10M11 20h2" />
                </svg>
                {t('deals.filters')}
                {activeFiltersCount > 0 && (
                  <span className="bg-white text-[var(--accent)] rounded-full min-w-[1.1rem] h-[1.1rem] px-1 flex items-center justify-center text-[10px] font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={loadList}
                disabled={listFetching}
                className="border border-[var(--border)] rounded-lg p-2 hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-50"
              >
                <svg className={`w-4 h-4 text-[var(--text-secondary)] ${listFetching ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </>
          )}

          {/* Board / List toggle */}
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            <button
              type="button"
              onClick={() => setView('board')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                view === 'board'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {t('deals.board')}
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                view === 'list'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {t('deals.list')}
            </button>
            <button
              type="button"
              onClick={() => setView('renewals')}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                view === 'renewals'
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
              title={`Active/signed deals ending within ${RENEWAL_WINDOW_DAYS} days`}
            >
              {t('deals.renewals')}
            </button>
          </div>
        </div>
      </div>

      {/* ── RENEWALS VIEW ─────────────────────────────────────── */}
      {view === 'renewals' && (
        <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between shrink-0">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-[var(--text)]">{t('deals.renewals')}</h2>
              <span className="text-xs text-[var(--text-secondary)]">
                {t('deals.renewalsSubtitle', { days: RENEWAL_WINDOW_DAYS })}
              </span>
            </div>
            <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] px-2 py-1 rounded-full">
              {renewals.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {renewalsLoading ? (
              <div className="p-6 text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>
            ) : renewals.length === 0 ? (
              <div className="p-6 text-[var(--text-secondary)] text-sm">{t('common.noData')}</div>
            ) : (
              <table className="w-full">
                <thead className="sticky top-0 bg-[var(--bg-card)]">
                  <tr className="border-b border-[var(--border)]">
                    {[t('deals.colTitle'), t('deals.colClient'), t('deals.colAssigned'), t('deals.colValue'), t('deals.daysLeft'), t('deals.colClose')].map((h) => (
                      <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] px-4 py-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {renewals.map((d) => {
                    const days = daysUntil(d.end_date)
                    const urgency =
                      days == null ? 'text-[var(--text-secondary)]'
                      : days <= 14 ? 'text-red-500 font-semibold'
                      : days <= 30 ? 'text-orange-500 font-semibold'
                      : 'text-[var(--text)]'
                    return (
                      <tr key={d.id} onClick={() => navigate(`/deals/${d.id}`)} className="hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                        <td className="px-4 py-3 text-sm font-medium text-[var(--accent)]">{d.title}</td>
                        <td className="px-4 py-3 text-sm text-[var(--text)]">{d.client?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{d.assigned_to?.full_name ?? '—'}</td>
                        <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">{formatDeal(d)}</td>
                        <td className={`px-4 py-3 text-sm ${urgency}`}>
                          {days == null ? '—' : days < 0 ? t('deals.expiredAgo', { days: Math.abs(days) }) : t('deals.daysInN', { days })}
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{formatDate(d.end_date)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── BOARD VIEW ──────────────────────────────────────── */}
      {view === 'board' && (
        boardLoading ? (
          <div className="text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>
        ) : (
          <div className="overflow-x-auto pb-4 flex-1 min-h-0">
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
              <div className="flex gap-3 min-w-max h-full">
                {DEAL_STATUSES.map((status) => {
                  const colDeals = (board[status] ?? []).filter(
                    d => !currentPipelineId || (d as any).pipeline == null || (d as any).pipeline === currentPipelineId
                  )
                  return (
                    <KanbanColumn key={status} status={status} label={DEAL_STATUS_LABELS[status]} deals={colDeals} draggingId={draggingDeal?.id} />
                  )
                })}
              </div>
              <DragOverlay dropAnimation={null}>
                {draggingDeal ? (
                  <div className="bg-[var(--bg-card)] border-2 border-[var(--accent)] rounded-lg p-3 shadow-2xl opacity-95 w-56 rotate-2 cursor-grabbing">
                    <p className="text-sm font-semibold text-[var(--text)] truncate">{draggingDeal.title}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">{draggingDeal.client?.name ?? '—'}</p>
                    <p className="text-sm font-bold text-[var(--accent)] mt-1">{formatDeal(draggingDeal)}</p>
                    <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-medium">
                      {DEAL_STATUS_LABELS[draggingDeal.status]}
                    </span>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        )
      )}

      {/* ── LOST REASON MODAL ──────────────────────────────── */}
      {lostReasonPending && (
        <LostReasonModal
          onSubmit={handleLostReasonSubmit}
          onCancel={handleLostReasonCancel}
        />
      )}

      {/* ── LIST VIEW ───────────────────────────────────────── */}
      {view === 'list' && (
        <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">

          {/* Filters panel */}
          {showFilters && (
            <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-hover)] flex flex-wrap gap-3 items-end shrink-0">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('deals.colStatus')}</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilter('status', e.target.value)}
                  className={inputCls}
                >
                  <option value="">{t('deals.allStatuses')}</option>
                  {DEAL_STATUSES.map((s) => (
                    <option key={s} value={s}>{DEAL_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">{t('deals.colCreated')}</label>
                <select
                  value={filters.ordering}
                  onChange={(e) => setFilter('ordering', e.target.value)}
                  className={inputCls}
                >
                  <option value="-created_at">{t('deals.sortNewest')}</option>
                  <option value="created_at">{t('deals.sortOldest')}</option>
                  <option value="title">Название A→Z</option>
                  <option value="-title">Название Z→A</option>
                  <option value="-value_usd">{t('deals.colValue')} ↓</option>
                  <option value="value_usd">{t('deals.colValue')} ↑</option>
                  <option value="expected_close_date">{t('deals.colClose')} ↑</option>
                  <option value="-expected_close_date">{t('deals.colClose')} ↓</option>
                </select>
              </div>
              {activeFiltersCount > 0 && (
                <button type="button" onClick={resetFilters} className="text-sm text-[var(--danger)] hover:underline py-2">
                  {t('clients.clearFilters')}
                </button>
              )}
            </div>
          )}

          {/* Table */}
          <div className="flex-1 overflow-auto min-h-0">
            {!listData ? (
              <div className="text-[var(--text-secondary)] text-sm p-6">{t('common.loading')}</div>
            ) : listData.results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
                <div className="text-4xl">📋</div>
                <p className="text-[var(--text)] font-medium">{t('deals.noDeals')}</p>
                <p className="text-sm text-[var(--text-secondary)]">{t('deals.filters')}</p>
              </div>
            ) : (
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-[var(--bg-card)] border-b border-[var(--border)]">
                  <tr>
                    {[t('deals.colTitle'), t('deals.colClient'), t('deals.colAssigned'), t('deals.colValue'), t('deals.colStatus'), t('deals.colCreated'), t('deals.colClose')].map((col) => (
                      <th key={col} className="px-4 py-3 text-left text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listData.results.map((deal) => (
                    <tr
                      key={deal.id}
                      onClick={() => navigate(`/deals/${deal.id}`)}
                      className="border-b border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-[var(--text)]">{deal.title}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                        {deal.client?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                        {deal.assigned_to?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text)] font-medium">
                        {formatDeal(deal)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[deal.status]}`}>
                          {DEAL_STATUS_LABELS[deal.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                        {formatDate(deal.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                        {formatDate(deal.expected_close_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {listData && listData.count > 0 && (
            <div className="border-t border-[var(--border)] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-[var(--bg-hover)]">
              <span className="text-xs text-[var(--text-secondary)]">
                {listFrom}–{listTo} {t('deals.of')} {listData.count}
              </span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-secondary)]">{t('deals.perPage')}</span>
                <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
                  {PAGE_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => { setListPageSize(size); setListPage(1) }}
                      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                        listPageSize === size
                          ? 'bg-[var(--accent)] text-white'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card)]'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-[var(--text-secondary)]">
                  {t('deals.page')} {listPage} {t('deals.of')} {totalPages}
                </span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setListPage((p) => Math.max(1, p - 1))}
                    disabled={listPage <= 1}
                    className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--bg-card)] disabled:opacity-40 transition-colors"
                  >
                    {t('deals.prev')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setListPage((p) => Math.min(totalPages, p + 1))}
                    disabled={listPage >= totalPages}
                    className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg hover:bg-[var(--bg-card)] disabled:opacity-40 transition-colors"
                  >
                    {t('deals.next')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
