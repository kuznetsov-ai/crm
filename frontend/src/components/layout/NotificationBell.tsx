import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { tasksApi, type Task, PRIORITY_LABELS, PRIORITY_COLORS } from '../../api/tasks'

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}

type Notification = {
  id: number
  type: 'overdue' | 'upcoming' | 'task'
  title: string
  subtitle: string
  date: string
  taskId: number
  isUnread: boolean
}

function toNotification(task: Task): Notification {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const deadline = task.deadline ? new Date(task.deadline) : null
  const isOverdue = task.is_overdue && task.status !== 'done'
  const isToday = deadline ? deadline.toDateString() === today.toDateString() : false
  const isTomorrow = deadline ? (() => {
    const tom = new Date(today); tom.setDate(tom.getDate() + 1)
    return deadline.toDateString() === tom.toDateString()
  })() : false

  let type: Notification['type'] = 'task'
  let subtitle = `Задача · ${PRIORITY_LABELS[task.priority]}`
  if (isOverdue) { type = 'overdue'; subtitle = `Просрочено · ${PRIORITY_LABELS[task.priority]}` }
  else if (isToday) { type = 'upcoming'; subtitle = `Сегодня · ${PRIORITY_LABELS[task.priority]}` }
  else if (isTomorrow) { type = 'upcoming'; subtitle = `Завтра · ${PRIORITY_LABELS[task.priority]}` }

  const dateStr = task.deadline
    ? new Date(task.deadline).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
    : ''

  return { id: task.id, type, title: task.title, subtitle, date: dateStr, taskId: task.id, isUnread: isOverdue || isToday }
}

const TYPE_COLORS: Record<Notification['type'], string> = {
  overdue: 'text-red-500',
  upcoming: 'text-orange-500',
  task: 'text-[var(--text-secondary)]',
}
const TYPE_LABELS: Record<Notification['type'], string> = {
  overdue: 'Просрочено',
  upcoming: 'Скоро',
  task: 'Задача',
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [readIds, setReadIds] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('crm_read_notifs') ?? '[]') as number[]) }
    catch { return new Set() }
  })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    tasksApi.list({ page_size: '200', ordering: 'deadline' })
      .then((page) => {
        const active = page.results.filter((t) => t.status !== 'done' && t.deadline)
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const in3days = new Date(today); in3days.setDate(in3days.getDate() + 3)
        const relevant = active.filter((t) => {
          const d = new Date(t.deadline!)
          return t.is_overdue || d <= in3days
        })
        setNotifications(relevant.map(toNotification))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unreadCount = notifications.filter((n) => n.isUnread && !readIds.has(n.id)).length

  const markAllRead = () => {
    const all = new Set([...readIds, ...notifications.map((n) => n.id)])
    setReadIds(all)
    localStorage.setItem('crm_notifs_read', JSON.stringify([...all]))
  }

  const handleOpen = () => {
    setOpen((v) => !v)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
        aria-label="Уведомления"
        title="Уведомления"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--text)]">Уведомления</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Отметить все прочитанными
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm text-[var(--text-secondary)]">Нет уведомлений</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isRead = readIds.has(n.id)
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      setReadIds((prev) => { const s = new Set(prev); s.add(n.id); return s })
                      navigate('/tasks')
                      setOpen(false)
                    }}
                    className="w-full text-left px-4 py-3 border-b border-[var(--border)]/60 hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-semibold uppercase tracking-wide ${TYPE_COLORS[n.type]}`}>
                            {TYPE_LABELS[n.type]}
                          </span>
                          {!isRead && n.isUnread && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                          )}
                        </div>
                        <p className="text-sm font-medium text-[var(--text)] truncate">{n.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs ${PRIORITY_COLORS[
                            notifications.find(x => x.id === n.id) ? 'low' : 'low'
                          ]}`}>{n.subtitle}</span>
                          {n.date && <span className="text-xs text-[var(--text-secondary)]">· {n.date}</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-[var(--border)]">
              <button
                onClick={() => { navigate('/tasks'); setOpen(false) }}
                className="text-xs text-[var(--accent)] hover:underline w-full text-center"
              >
                Все задачи →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
