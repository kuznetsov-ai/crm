import { useState, useEffect, useCallback, useRef } from 'react'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTranslation } from 'react-i18next'
import api from '../api/client'

// ─── Types ───────────────────────────────────────────────────────────────────

type Priority = 'low' | 'medium' | 'high'
type Status = 'idea' | 'in_progress' | 'testing' | 'done'

interface BacklogItem {
  id: number
  title: string
  description: string
  status: Status
  priority: Priority
  author: { id: number; full_name: string } | null
  votes: number
  order: number
  comments_count: number
  created_at: string
}

interface BacklogComment {
  id: number
  author: { id: number; full_name: string } | null
  text: string
  created_at: string
}

type Board = Record<Status, BacklogItem[]>

// ─── Constants ───────────────────────────────────────────────────────────────

const COLUMNS: { status: Status; label: string }[] = [
  { status: 'idea', label: 'Идеи' },
  { status: 'in_progress', label: 'В работе' },
  { status: 'testing', label: 'Тестирование' },
  { status: 'done', label: 'Готово' },
]

const PRIORITY_CONFIG: Record<Priority, { label: string; className: string }> = {
  high:   { label: 'Высокий', className: 'bg-orange-500/15 text-orange-500' },
  medium: { label: 'Средний', className: 'bg-blue-500/15 text-blue-500' },
  low:    { label: 'Низкий',  className: 'bg-[var(--bg-hover)] text-[var(--text-secondary)]' },
}

const STATUS_LABELS: Record<Status, string> = {
  idea: 'Идея',
  in_progress: 'В работе',
  testing: 'Тестирование',
  done: 'Готово',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Priority Badge ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: Priority }) {
  const { label, className } = PRIORITY_CONFIG[priority]
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${className}`}>
      {label}
    </span>
  )
}

// ─── Detail Modal ────────────────────────────────────────────────────────────

function BacklogModal({
  item,
  onClose,
  onVote,
  onCommentAdded,
}: {
  item: BacklogItem
  onClose: () => void
  onVote: (id: number) => void
  onCommentAdded: (id: number) => void
}) {
  const [comments, setComments] = useState<BacklogComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setCommentsLoading(true)
    api.get(`/backlog/${item.id}/comments/`)
      .then(({ data }) => {
        const list: BacklogComment[] = Array.isArray(data) ? data : data.results ?? []
        setComments(list)
      })
      .finally(() => setCommentsLoading(false))
  }, [item.id])

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || submitting) return
    setSubmitting(true)
    try {
      const { data } = await api.post(`/backlog/${item.id}/comments/`, { text: commentText.trim() })
      setComments((prev) => [...prev, data])
      setCommentText('')
      onCommentAdded(item.id)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start gap-3 px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-[var(--text)] leading-snug">{item.title}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <PriorityBadge priority={item.priority} />
              <span className="text-[10px] font-medium text-[var(--text-secondary)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded uppercase tracking-wide">
                {STATUS_LABELS[item.status]}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors p-1 rounded hover:bg-[var(--bg-hover)] -mt-0.5"
            aria-label="Закрыть"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Description */}
          {item.description ? (
            <div>
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1.5">Описание</p>
              <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">{item.description}</p>
            </div>
          ) : (
            <p className="text-sm text-[var(--text-secondary)] italic">Описание не указано.</p>
          )}

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div>
              <span className="text-[var(--text-secondary)]">Автор</span>
              <span className="ml-2 text-[var(--text)] font-medium">{item.author?.full_name ?? '—'}</span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">Дата создания</span>
              <span className="ml-2 text-[var(--text)] font-medium">{formatDate(item.created_at)}</span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">Голоса</span>
              <span className="ml-2 text-[var(--text)] font-medium">👍 {item.votes}</span>
            </div>
            <div>
              <span className="text-[var(--text-secondary)]">Комментарии</span>
              <span className="ml-2 text-[var(--text)] font-medium">{item.comments_count}</span>
            </div>
          </div>

          {/* Vote button */}
          <button
            onClick={() => onVote(item.id)}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] border border-[var(--border)] hover:border-[var(--accent)]/50 px-3 py-1.5 rounded transition-colors"
          >
            👍 Голосовать ({item.votes})
          </button>

          {/* Divider */}
          <div className="border-t border-[var(--border)]" />

          {/* Comments */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-3">
              Комментарии ({comments.length})
            </p>

            {commentsLoading ? (
              <p className="text-xs text-[var(--text-secondary)]">Загружаем комментарии…</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] italic">Комментариев пока нет.</p>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-[var(--accent)]/15 flex items-center justify-center text-xs font-semibold text-[var(--accent)] flex-shrink-0">
                      {c.author?.full_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-xs font-medium text-[var(--text)]">{c.author?.full_name ?? 'Неизвестный'}</span>
                        <span className="text-[10px] text-[var(--text-secondary)]">{formatDate(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-[var(--text)] leading-relaxed">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add comment form */}
            <form onSubmit={submitComment} className="mt-4 space-y-2">
              <textarea
                ref={textareaRef}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Написать комментарий…"
                rows={3}
                className="w-full text-sm border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--accent)] resize-none placeholder:text-[var(--text-secondary)]"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !commentText.trim()}
                  className="bg-[var(--accent)] text-white text-xs font-medium px-4 py-1.5 rounded disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {submitting ? 'Отправка…' : 'Отправить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sortable card (same drag pattern as KanbanCard: whole card is draggable) ─

function BacklogCard({
  item,
  onVote,
  onClick,
  dragEnabled,
}: {
  item: BacklogItem
  onVote: (id: number) => void
  onClick: (item: BacklogItem) => void
  dragEnabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: !dragEnabled,
  })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-[var(--bg-main)] rounded-[var(--radius-md)] p-3 border transition-all shadow-sm
        ${dragEnabled ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}
        ${isDragging && dragEnabled
          ? 'opacity-30 border-[var(--accent)] scale-95'
          : 'border-[var(--border)] hover:border-[var(--accent)]/50 hover:shadow-md'
        }`}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClick(item) }}
        className="font-medium text-sm text-[var(--text)] hover:text-[var(--accent)] block mb-1 line-clamp-2 text-left w-full"
      >
        {item.title}
      </button>
      {item.description ? (
        <p className="text-xs text-[var(--text-secondary)] mb-2 line-clamp-2">{item.description}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <PriorityBadge priority={item.priority} />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onVote(item.id) }}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-[var(--text-secondary)] hover:text-[var(--accent)] font-medium"
        >
          👍 {item.votes}
        </button>
        <div className="flex items-center gap-2 text-[var(--text-secondary)] min-w-0 justify-end">
          {item.comments_count > 0 ? (
            <span className="truncate">💬 {item.comments_count}</span>
          ) : null}
          {item.author ? (
            <span className="truncate max-w-[6.5rem]">{item.author.full_name}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ─── Droppable column ─────────────────────────────────────────────────────────

function BacklogColumn({
  status,
  label,
  items,
  onVote,
  onCardClick,
  dragEnabled,
}: {
  status: Status
  label: string
  items: BacklogItem[]
  onVote: (id: number) => void
  onCardClick: (item: BacklogItem) => void
  dragEnabled: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !dragEnabled })

  return (
    <div className="flex flex-col min-w-0" style={{ minHeight: 'calc(100vh - 200px)' }}>
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-xs font-semibold text-[var(--text)] uppercase tracking-wide">{label}</h3>
        <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>

      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex-1 space-y-2 rounded-lg p-2 transition-all ${
            isOver && dragEnabled
              ? 'bg-[var(--accent)]/10 border-2 border-dashed border-[var(--accent)]/50'
              : 'bg-[var(--bg-hover)]/40 border-2 border-transparent'
          }`}
        >
          {items.map((item) => (
            <BacklogCard
              key={item.id}
              item={item}
              onVote={onVote}
              onClick={onCardClick}
              dragEnabled={dragEnabled}
            />
          ))}
          {items.length === 0 && (
            <div
              className={`h-16 rounded-lg flex items-center justify-center text-xs transition-colors ${
                isOver && dragEnabled ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
              }`}
            >
              {isOver && dragEnabled ? 'Отпусти здесь' : 'Нет карточек'}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BacklogPage() {
  const { t } = useTranslation()
  const [board, setBoard] = useState<Board>({ idea: [], in_progress: [], testing: [], done: [] })
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [newPriority, setNewPriority] = useState<Priority>('medium')
  const [adding, setAdding] = useState(false)
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all')
  const [selectedItem, setSelectedItem] = useState<BacklogItem | null>(null)
  const [draggingItem, setDraggingItem] = useState<BacklogItem | null>(null)
  const savedBoard = useRef<Board>({ idea: [], in_progress: [], testing: [], done: [] })
  const newTitleRef = useRef<HTMLTextAreaElement>(null)

  const autoGrow = (ta: HTMLTextAreaElement | null) => {
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 220)}px`
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const load = useCallback(async () => {
    const { data } = await api.get('/backlog/?page_size=200')
    const items: BacklogItem[] = Array.isArray(data) ? data : data.results ?? []
    const grouped: Board = { idea: [], in_progress: [], testing: [], done: [] }
    items.forEach((item) => { (grouped[item.status] ??= []).push(item) })
    COLUMNS.forEach(({ status }) => { grouped[status].sort((a, b) => a.order - b.order) })
    setBoard(grouped)
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  const vote = async (id: number) => {
    await api.post(`/backlog/${id}/vote/`)
    setBoard((prev) => {
      const next = { ...prev }
      for (const status of Object.keys(next) as Status[]) {
        next[status] = next[status].map((i) => i.id === id ? { ...i, votes: i.votes + 1 } : i)
      }
      return next
    })
    // Also update selected item if open
    setSelectedItem((prev) => prev?.id === id ? { ...prev, votes: prev.votes + 1 } : prev)
  }

  const addIdea = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    try {
      const { data } = await api.post('/backlog/', { title: newTitle.trim(), status: 'idea', priority: newPriority })
      setBoard((prev) => ({ ...prev, idea: [data, ...prev.idea] }))
      setNewTitle('')
      if (newTitleRef.current) {
        newTitleRef.current.style.height = 'auto'
      }
    } finally {
      setAdding(false)
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    if (priorityFilter !== 'all') return
    const id = Number(event.active.id)
    for (const items of Object.values(board)) {
      const found = items.find(i => i.id === id)
      if (found) { setDraggingItem(found); break }
    }
    savedBoard.current = JSON.parse(JSON.stringify(board))
  }

  // Note: onDragOver was removed. Moving items between SortableContexts mid-drag
  // caused an infinite setState loop inside dnd-kit's useRect (measureRect →
  // setRect → re-render → reparented DOM → MutationObserver → measureRect).
  // All reorder/cross-column logic now runs on dragEnd only. DragOverlay still
  // provides visual feedback while dragging.

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingItem(null)
    if (priorityFilter !== 'all') return
    const { active, over } = event
    if (!over) return
    const activeId = Number(active.id)
    const overId = String(over.id)

    // Source status from snapshot (board wasn't mutated during drag anymore)
    let fromStatus: Status | '' = ''
    for (const [s, items] of Object.entries(savedBoard.current)) {
      if (items.find((i) => i.id === activeId)) { fromStatus = s as Status; break }
    }
    if (!fromStatus) return

    // Resolve target: column id directly OR card id → its column
    const STATUSES = COLUMNS.map((c) => c.status)
    let toStatus: Status = fromStatus
    if (STATUSES.includes(overId as Status)) {
      toStatus = overId as Status
    } else {
      for (const [s, items] of Object.entries(savedBoard.current)) {
        if (items.find((i) => i.id === Number(overId))) { toStatus = s as Status; break }
      }
    }

    if (fromStatus === toStatus) {
      // Same-column reorder
      const col = [...board[toStatus]]
      const oi = col.findIndex((i) => i.id === activeId)
      const ni = col.findIndex((i) => i.id === Number(overId))
      if (oi < 0 || ni < 0 || oi === ni) return
      const reordered = arrayMove(col, oi, ni)
      setBoard((prev) => ({ ...prev, [toStatus]: reordered }))
      try {
        await Promise.all(reordered.map((item, idx) => api.patch(`/backlog/${item.id}/`, { order: idx })))
      } catch { load() }
      return
    }

    // Cross-column: move card now (on drop), update status, persist
    const moving = board[fromStatus]?.find((i) => i.id === activeId)
    if (!moving) return
    const updated: BacklogItem = { ...moving, status: toStatus }
    const fromCol = board[fromStatus].filter((i) => i.id !== activeId)
    const toColBase = [...(board[toStatus] ?? [])]
    const insertAt = toColBase.findIndex((i) => i.id === Number(overId))
    insertAt >= 0 ? toColBase.splice(insertAt, 0, updated) : toColBase.push(updated)
    setBoard((prev) => ({ ...prev, [fromStatus]: fromCol, [toStatus]: toColBase }))
    try {
      await api.patch(`/backlog/${activeId}/`, { status: toStatus })
      await Promise.all(toColBase.map((item, idx) => api.patch(`/backlog/${item.id}/`, { order: idx })))
    } catch { setBoard(savedBoard.current) }
  }

  const handleCommentAdded = (id: number) => {
    setBoard((prev) => {
      const next = { ...prev }
      for (const status of Object.keys(next) as Status[]) {
        next[status] = next[status].map((i) => i.id === id ? { ...i, comments_count: i.comments_count + 1 } : i)
      }
      return next
    })
    setSelectedItem((prev) => prev?.id === id ? { ...prev, comments_count: prev.comments_count + 1 } : prev)
  }

  // Filtered board based on priority filter
  const filteredBoard: Board = Object.fromEntries(
    COLUMNS.map(({ status }) => [
      status,
      priorityFilter === 'all'
        ? board[status] ?? []
        : (board[status] ?? []).filter((i) => i.priority === priorityFilter),
    ])
  ) as Board

  if (loading) return <div className="text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-[var(--text)]">{t('nav.backlog')}</h1>
      </div>

      {/* Add idea form */}
      <form
        onSubmit={addIdea}
        className="mb-5 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-2.5 flex gap-2 items-start"
      >
        <select
          value={newPriority}
          onChange={(e) => setNewPriority(e.target.value as Priority)}
          className="text-sm border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] rounded-lg px-2 h-9 focus:outline-none focus:border-[var(--accent)] flex-shrink-0"
        >
          <option value="high">Высокий</option>
          <option value="medium">Средний</option>
          <option value="low">Низкий</option>
        </select>
        <textarea
          ref={newTitleRef}
          value={newTitle}
          onChange={(e) => {
            setNewTitle(e.target.value)
            autoGrow(e.target)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              addIdea(e as unknown as React.FormEvent)
            }
          }}
          placeholder="Новая идея…"
          rows={1}
          className="flex-1 min-w-0 text-sm border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-secondary)] resize-none overflow-y-auto leading-5 block"
          style={{ maxHeight: '220px', minHeight: '36px' }}
        />
        <button
          type="submit"
          disabled={adding || !newTitle.trim()}
          className="bg-[var(--accent)] text-white text-sm font-medium px-3 h-9 rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity flex-shrink-0"
        >
          + Добавить
        </button>
      </form>

      {/* Priority filter */}
      <div className="flex items-center gap-1.5 mb-5">
        {(['all', 'high', 'medium', 'low'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPriorityFilter(p)}
            className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors border ${
              priorityFilter === p
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text)] hover:border-[var(--text-secondary)]'
            }`}
          >
            {p === 'all' ? 'Все' : PRIORITY_CONFIG[p].label}
          </button>
        ))}
        {priorityFilter !== 'all' && (
          <span className="text-xs text-[var(--text-secondary)] ml-1">
            {COLUMNS.reduce((sum, { status }) => sum + filteredBoard[status].length, 0)} карточек · перетаскивание выключено
          </span>
        )}
      </div>

      {/* Kanban board */}
      <div className="pb-4">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {COLUMNS.map(({ status, label }) => (
              <BacklogColumn
                key={status}
                status={status}
                label={label}
                items={filteredBoard[status] ?? []}
                onVote={vote}
                onCardClick={setSelectedItem}
                dragEnabled={priorityFilter === 'all'}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {draggingItem ? (
              <div className="bg-[var(--bg-main)] border-2 border-[var(--accent)] rounded-[var(--radius-md)] p-3 shadow-2xl rotate-2 cursor-grabbing opacity-95 w-[min(90vw,18rem)]">
                <p className="text-sm font-semibold text-[var(--text)] line-clamp-2">{draggingItem.title}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                  <PriorityBadge priority={draggingItem.priority} />
                  <span className="text-[10px] font-medium text-[var(--text-secondary)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded uppercase">
                    {STATUS_LABELS[draggingItem.status]}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>👍 {draggingItem.votes}</span>
                  {draggingItem.author ? <span className="truncate max-w-[7rem]">{draggingItem.author.full_name}</span> : null}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Detail modal */}
      {selectedItem && (
        <BacklogModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onVote={vote}
          onCommentAdded={handleCommentAdded}
        />
      )}
    </div>
  )
}
