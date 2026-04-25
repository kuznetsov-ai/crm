import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { tasksApi, type Task, PRIORITY_LABELS, PRIORITY_COLORS, STATUS_LABELS } from '../api/tasks'
import { DndContext, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const STATUS_CYCLE: Task['status'][] = ['todo', 'in_progress', 'done']
const PRIORITY_CYCLE: Task['priority'][] = ['low', 'medium', 'high', 'urgent']
const STATUS_OPTIONS = ['', 'todo', 'in_progress', 'done'] as const
const PRIORITY_OPTIONS = ['', 'low', 'medium', 'high', 'urgent'] as const

interface CreateForm {
  title: string
  priority: Task['priority']
  status: Task['status']
  deadline: string
}
const EMPTY_FORM: CreateForm = { title: '', priority: 'medium', status: 'todo', deadline: '' }

function StatusButton({ task, onCycle, updating }: { task: Task; onCycle: () => void; updating: boolean }) {
  const { status } = task
  return (
    <button
      onClick={onCycle}
      disabled={updating}
      title={`Статус: ${STATUS_LABELS[status]} → нажми для смены`}
      className={`mt-0.5 w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center transition-all select-none
        ${updating ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
        ${status === 'done'
          ? 'bg-[var(--success)] border-[var(--success)] text-white'
          : status === 'in_progress'
            ? 'bg-[var(--warning)]/20 border-[var(--warning)] text-[var(--warning)]'
            : 'border-[var(--border)] hover:border-[var(--accent)]'
        }`}
    >
      {status === 'done' && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {status === 'in_progress' && (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
          <circle cx="4" cy="4" r="3"/>
        </svg>
      )}
    </button>
  )
}

function SortableTaskRow({ task, updating, isDraggingThis, onStatusCycle, onPriorityCycle }: {
  task: Task
  updating: boolean
  isDraggingThis: boolean
  onStatusCycle: () => void
  onPriorityCycle: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const isDone = task.status === 'done'
  const isOverdue = task.is_overdue && !isDone

  const STATUS_DOT: Record<Task['status'], string> = {
    todo: 'bg-[var(--border)]',
    in_progress: 'bg-[var(--warning)]',
    done: 'bg-[var(--success)]',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-[var(--bg-card)] rounded-lg border flex items-stretch transition-all
        ${isDragging ? 'opacity-30 scale-95' : ''}
        ${isDraggingThis ? '' : ''}
        ${isOverdue ? 'border-[var(--danger)]/50' : 'border-[var(--border)]'}`}
    >
      {/* Drag handle — left strip */}
      <div
        {...attributes}
        {...listeners}
        className="w-7 flex items-center justify-center cursor-grab active:cursor-grabbing text-[var(--border)] hover:text-[var(--text-secondary)] transition-colors shrink-0 border-r border-[var(--border)] select-none"
        title="Перетащи для сортировки"
      >
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
          <circle cx="3" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/>
          <circle cx="3" cy="7" r="1.5"/><circle cx="7" cy="7" r="1.5"/>
          <circle cx="3" cy="12" r="1.5"/><circle cx="7" cy="12" r="1.5"/>
        </svg>
      </div>

      {/* Red bar for overdue */}
      {isOverdue && <div className="w-1 bg-[var(--danger)] flex-shrink-0" />}

      <div className={`flex items-start gap-3 flex-1 p-3.5 ${isOverdue ? 'pl-2' : ''}`}>
        <StatusButton task={task} onCycle={onStatusCycle} updating={updating} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className={`text-sm font-medium ${isDone ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text)]'}`}>
              {task.title}
            </span>
            <button onClick={onPriorityCycle} disabled={updating} title="Нажми для смены приоритета"
              className={`text-xs font-semibold flex-shrink-0 px-2 py-0.5 rounded hover:opacity-70 transition-opacity cursor-pointer disabled:opacity-40 ${PRIORITY_COLORS[task.priority]}`}>
              {PRIORITY_LABELS[task.priority]}
            </button>
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <button onClick={onStatusCycle} disabled={updating} title="Нажми для смены статуса"
              className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors cursor-pointer disabled:opacity-40">
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[task.status]}`} />
              {STATUS_LABELS[task.status]}
            </button>
            {task.assigned_to && <span className="text-xs text-[var(--text-secondary)]">{task.assigned_to.full_name}</span>}
            {task.deadline && (
              <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-[var(--danger)] font-medium' : 'text-[var(--text-secondary)]'}`}>
                {new Date(task.deadline).toLocaleDateString('ru-RU')}
              </span>
            )}
            {task.linked_client && (
              <Link to={`/clients/${task.linked_client}`} className="text-xs text-[var(--accent)] hover:underline">
                👤 Клиент #{task.linked_client}
              </Link>
            )}
            {task.linked_deal && (
              <Link to={`/deals/${task.linked_deal}`} className="text-xs text-[var(--accent)] hover:underline">
                💼 Сделка #{task.linked_deal}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TasksPage() {
  const { t } = useTranslation()
  const [tasks, setTasks] = useState<Task[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set())
  const [draggingTask, setDraggingTask] = useState<Task | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      const data = await tasksApi.list(params)
      setTasks(data.results)
      setCount(data.count)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [statusFilter, priorityFilter])

  useEffect(() => {
    if (modalOpen) {
      setForm(EMPTY_FORM); setFormError('')
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [modalOpen])

  const startUpdate = (id: number) => setUpdatingIds(p => new Set(p).add(id))
  const endUpdate = (id: number) => setUpdatingIds(p => { const s = new Set(p); s.delete(id); return s })

  // Cycle status: todo → in_progress → done → todo
  const handleStatusCycle = async (task: Task) => {
    if (updatingIds.has(task.id)) return
    const idx = STATUS_CYCLE.indexOf(task.status)
    const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    startUpdate(task.id)
    try {
      const updated = await tasksApi.update(task.id, { status: nextStatus })
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    } finally { endUpdate(task.id) }
  }

  // Cycle priority: low → medium → high → urgent → low
  const handlePriorityCycle = async (task: Task) => {
    if (updatingIds.has(task.id)) return
    const idx = PRIORITY_CYCLE.indexOf(task.priority)
    const nextPriority = PRIORITY_CYCLE[(idx + 1) % PRIORITY_CYCLE.length]
    startUpdate(task.id)
    try {
      const updated = await tasksApi.update(task.id, { priority: nextPriority })
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    } finally { endUpdate(task.id) }
  }

  const handleDragStart = (e: DragStartEvent) => {
    const found = tasks.find(t => t.id === Number(e.active.id))
    if (found) setDraggingTask(found)
  }

  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingTask(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    setTasks(prev => {
      const oi = prev.findIndex(t => t.id === Number(active.id))
      const ni = prev.findIndex(t => t.id === Number(over.id))
      return arrayMove(prev, oi, ni)
    })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setFormError('Введите название'); return }
    setSaving(true); setFormError('')
    try {
      const payload: Partial<Task> = {
        title: form.title.trim(),
        priority: form.priority,
        status: form.status,
        ...(form.deadline ? { deadline: form.deadline } : {}),
      }
      const created = await tasksApi.create(payload)
      setTasks(prev => [created, ...prev])
      setCount(c => c + 1)
      setModalOpen(false)
    } catch { setFormError('Ошибка. Попробуйте ещё раз.') }
    finally { setSaving(false) }
  }

  const STATUS_DOT: Record<Task['status'], string> = {
    todo: 'bg-[var(--border)]',
    in_progress: 'bg-[var(--warning)]',
    done: 'bg-[var(--success)]',
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-[var(--text)]">
          {t('nav.tasks')} <span className="text-[var(--text-secondary)] text-lg font-normal">({count})</span>
        </h1>
        <button onClick={() => setModalOpen(true)}
          className="bg-[var(--accent)] text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">
          + {t('tasks.add')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--accent)]">
          <option value="">{t('tasks.allStatuses')}</option>
          {STATUS_OPTIONS.filter(Boolean).map(s => <option key={s} value={s}>{STATUS_LABELS[s as Task['status']]}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          className="text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--accent)]">
          <option value="">{t('tasks.allPriorities')}</option>
          {PRIORITY_OPTIONS.filter(Boolean).map(p => <option key={p} value={p}>{PRIORITY_LABELS[p as Task['priority']]}</option>)}
        </select>
        <p className="text-xs text-[var(--text-secondary)] self-center">
          {t('tasks.hint')}
        </p>
      </div>

      {loading ? (
        <div className="text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>
      ) : tasks.length === 0 ? (
        <div className="text-[var(--text-secondary)] text-sm">{t('common.noData')}</div>
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {tasks.map((task) => (
                <SortableTaskRow
                  key={task.id}
                  task={task}
                  updating={updatingIds.has(task.id)}
                  isDraggingThis={draggingTask?.id === task.id}
                  onStatusCycle={() => handleStatusCycle(task)}
                  onPriorityCycle={() => handlePriorityCycle(task)}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {draggingTask ? (
              <div className="bg-[var(--bg-card)] border-2 border-[var(--accent)] rounded-lg px-4 py-3 shadow-2xl opacity-95 rotate-1 cursor-grabbing">
                <p className="text-sm font-medium text-[var(--text)] truncate">{draggingTask.title}</p>
                <p className={`text-xs mt-0.5 ${PRIORITY_COLORS[draggingTask.priority]}`}>{PRIORITY_LABELS[draggingTask.priority]}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Create task modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h2 className="text-base font-semibold text-[var(--text)]">{t('tasks.createTitle')}</h2>
              <button onClick={() => setModalOpen(false)} className="text-[var(--text-secondary)] hover:text-[var(--text)] text-lg leading-none">×</button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
                  {t('tasks.titleRequired')} <span className="text-[var(--danger)]">*</span>
                </label>
                <input ref={titleRef} type="text" value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                  placeholder={t('tasks.titleLabel') + '...'}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)]"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">{t('tasks.priorityLabel')}</label>
                  <select value={form.priority} onChange={e => setForm({...form, priority: e.target.value as Task['priority']})}
                    className="w-full text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--accent)]">
                    {PRIORITY_OPTIONS.filter(Boolean).map(p => <option key={p} value={p}>{PRIORITY_LABELS[p as Task['priority']]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">{t('tasks.statusLabel')}</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value as Task['status']})}
                    className="w-full text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--accent)]">
                    {STATUS_OPTIONS.filter(Boolean).map(s => <option key={s} value={s}>{STATUS_LABELS[s as Task['status']]}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">{t('tasks.deadlineLabel')}</label>
                <input type="date" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)]"/>
              </div>
              {formError && <p className="text-xs text-[var(--danger)]">{formError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setModalOpen(false)}
                  className="text-sm px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-hover)]">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={saving}
                  className="text-sm px-4 py-2 rounded-lg bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-60">
                  {saving ? t('tasks.creating') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
