import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import activitiesApi from '../../api/activities'
import type {
  Activity,
  ActivityEntity,
  ActivityType,
  CreateActivityPayload,
} from '../../api/activities'

// ── Icons ────────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<ActivityType, string> = {
  note: '📝',
  call: '📞',
  email: '✉️',
  meeting: '🤝',
  task: '✅',
  stage_change: '🔄',
  field_change: '✏️',
  created: '🆕',
  ai: '🤖',
}

const TYPE_COLORS: Record<ActivityType, string> = {
  note: '#6366f1',
  call: '#10b981',
  email: '#3b82f6',
  meeting: '#f59e0b',
  task: '#ef4444',
  stage_change: '#8b5cf6',
  field_change: '#64748b',
  created: '#22c55e',
  ai: '#06b6d4',
}

// ── Types that can be filtered ────────────────────────────────────────────────

const FILTER_TYPES: ActivityType[] = ['note', 'call', 'email', 'meeting', 'task']

// ── Inline form ──────────────────────────────────────────────────────────────

interface InlineFormProps {
  type: ActivityType
  entity: ActivityEntity
  entityId: number
  onSaved: (a: Activity) => void
  onCancel: () => void
}

function InlineForm({ type, entity, entityId, onSaved, onCancel }: InlineFormProps) {
  const { t } = useTranslation()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [saving, setSaving] = useState(false)

  const hasSubject = type === 'task' || type === 'meeting' || type === 'call'
  const hasDue = type === 'task' || type === 'meeting'

  async function handleSave() {
    if (!body.trim() && !subject.trim()) return
    setSaving(true)
    try {
      const payload: CreateActivityPayload = {
        type,
        entity,
        entity_id: entityId,
        subject: subject.trim(),
        body: body.trim(),
      }
      if (hasDue && dueAt) {
        payload.due_at = new Date(dueAt).toISOString()
      }
      const saved = await activitiesApi.create(payload)
      onSaved(saved)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        background: 'var(--bg-secondary, #f9fafb)',
      }}
    >
      {hasSubject && (
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t('activities.subject_placeholder')}
          style={{
            width: '100%', marginBottom: 8, padding: '6px 10px',
            border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--bg)', color: 'var(--text)',
          }}
        />
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={t('activities.body_placeholder')}
        style={{
          width: '100%', padding: '6px 10px',
          border: '1px solid var(--border)', borderRadius: 6,
          background: 'var(--bg)', color: 'var(--text)',
          resize: 'vertical',
        }}
      />
      {hasDue && (
        <input
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          placeholder={t('activities.due_at_placeholder')}
          style={{
            width: '100%', marginTop: 8, padding: '6px 10px',
            border: '1px solid var(--border)', borderRadius: 6,
            background: 'var(--bg)', color: 'var(--text)',
          }}
        />
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '6px 16px', borderRadius: 6,
            background: 'var(--accent, #6366f1)', color: '#fff',
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {t('activities.save')}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '6px 16px', borderRadius: 6,
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--text)', cursor: 'pointer',
          }}
        >
          {t('activities.cancel')}
        </button>
      </div>
    </div>
  )
}

// ── Activity item ────────────────────────────────────────────────────────────

interface ActivityItemProps {
  activity: Activity
  onPin: (a: Activity) => void
  onComplete: (a: Activity) => void
  onDelete: (a: Activity) => void
}

function ActivityItem({ activity: a, onPin, onComplete, onDelete }: ActivityItemProps) {
  const { t } = useTranslation()
  const icon = TYPE_ICONS[a.type] ?? '•'
  const color = TYPE_COLORS[a.type] ?? '#6b7280'
  const typeLabel = t(`activities.types.${a.type}`, a.type)

  const authorName =
    a.author?.full_name?.trim() || a.author?.email || '—'
  const createdAt = new Date(a.created_at).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div
      style={{
        display: 'flex', gap: 12, padding: '12px 0',
        borderBottom: '1px solid var(--border)',
        opacity: a.completed_at ? 0.65 : 1,
      }}
    >
      {/* Icon */}
      <div
        style={{
          flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
          background: color + '22', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 16,
        }}
      >
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
              color, letterSpacing: '0.05em',
            }}
          >
            {typeLabel}
          </span>
          {a.is_pinned && (
            <span style={{ fontSize: 11, color: '#f59e0b' }}>📌</span>
          )}
          {a.completed_at && (
            <span style={{ fontSize: 11, color: '#10b981' }}>✓ Выполнено</span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            {authorName} · {createdAt}
          </span>
        </div>

        {/* Subject */}
        {a.subject && (
          <div style={{ fontWeight: 600, marginTop: 4, fontSize: 14 }}>{a.subject}</div>
        )}

        {/* Body */}
        {a.body && (
          <div style={{ marginTop: 4, fontSize: 14, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
            {a.body}
          </div>
        )}

        {/* Stage change meta */}
        {a.type === 'stage_change' && a.meta && (
          <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-secondary)' }}>
            {String(a.meta.from_name ?? '—')} → {String(a.meta.to_name ?? '—')}
          </div>
        )}

        {/* Due date */}
        {a.due_at && (
          <div style={{ marginTop: 4, fontSize: 12, color: '#f59e0b' }}>
            Срок: {new Date(a.due_at).toLocaleString('ru-RU', {
              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
            })}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={() => onPin(a)}
            style={{
              fontSize: 12, padding: '2px 8px', borderRadius: 4,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            {a.is_pinned ? t('activities.unpin') : t('activities.pin')}
          </button>
          {(a.type === 'task' || a.type === 'meeting') && !a.completed_at && (
            <button
              onClick={() => onComplete(a)}
              style={{
                fontSize: 12, padding: '2px 8px', borderRadius: 4,
                border: '1px solid #10b981', background: 'transparent',
                color: '#10b981', cursor: 'pointer',
              }}
            >
              {t('activities.complete')}
            </button>
          )}
          <button
            onClick={() => onDelete(a)}
            style={{
              fontSize: 12, padding: '2px 8px', borderRadius: 4,
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-secondary)', cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export interface ActivityTimelineProps {
  entity: ActivityEntity
  entityId: number
}

export default function ActivityTimeline({ entity, entityId }: ActivityTimelineProps) {
  const { t } = useTranslation()

  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(false)
  const [filterType, setFilterType] = useState<ActivityType | null>(null)
  const [openForm, setOpenForm] = useState<ActivityType | null>(null)

  const loadActivities = useCallback(async () => {
    setLoading(true)
    try {
      const data = await activitiesApi.list({
        entity,
        entity_id: entityId,
        types: filterType ? [filterType] : undefined,
      })
      setActivities(data)
    } finally {
      setLoading(false)
    }
  }, [entity, entityId, filterType])

  useEffect(() => {
    loadActivities()
  }, [loadActivities])

  function handleSaved(a: Activity) {
    setActivities((prev) => [a, ...prev])
    setOpenForm(null)
  }

  async function handlePin(a: Activity) {
    const updated = await activitiesApi.pin(a.id)
    setActivities((prev) =>
      prev
        .map((x) => (x.id === a.id ? updated : x))
        .sort((x, y) => Number(y.is_pinned) - Number(x.is_pinned))
    )
  }

  async function handleComplete(a: Activity) {
    const updated = await activitiesApi.complete(a.id)
    setActivities((prev) => prev.map((x) => (x.id === a.id ? updated : x)))
  }

  async function handleDelete(a: Activity) {
    await activitiesApi.remove(a.id)
    setActivities((prev) => prev.filter((x) => x.id !== a.id))
  }

  return (
    <div
      data-testid="activity-timeline"
      style={{ padding: '16px 0' }}
    >
      {/* Title */}
      <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>
        {t('activities.title')}
      </h3>

      {/* Quick-add buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {(['note', 'call', 'meeting', 'task'] as ActivityType[]).map((type) => (
          <button
            key={type}
            onClick={() => setOpenForm(openForm === type ? null : type)}
            style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 13,
              border: '1px solid var(--border)',
              background: openForm === type ? 'var(--accent, #6366f1)' : 'transparent',
              color: openForm === type ? '#fff' : 'var(--text)',
              cursor: 'pointer',
            }}
          >
            {t(`activities.add_${type}`)}
          </button>
        ))}
      </div>

      {/* Inline form */}
      {openForm && (
        <InlineForm
          type={openForm}
          entity={entity}
          entityId={entityId}
          onSaved={handleSaved}
          onCancel={() => setOpenForm(null)}
        />
      )}

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <button
          onClick={() => setFilterType(null)}
          style={{
            padding: '4px 12px', borderRadius: 16, fontSize: 12,
            border: '1px solid var(--border)',
            background: filterType === null ? 'var(--accent, #6366f1)' : 'transparent',
            color: filterType === null ? '#fff' : 'var(--text)',
            cursor: 'pointer',
          }}
        >
          {t('activities.filter_all')}
        </button>
        {FILTER_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(filterType === type ? null : type)}
            style={{
              padding: '4px 12px', borderRadius: 16, fontSize: 12,
              border: '1px solid var(--border)',
              background: filterType === type ? TYPE_COLORS[type] : 'transparent',
              color: filterType === type ? '#fff' : 'var(--text)',
              cursor: 'pointer',
            }}
          >
            {TYPE_ICONS[type]} {t(`activities.types.${type}`)}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ color: 'var(--text-secondary)', padding: '16px 0' }}>
          {t('activities.loading')}
        </div>
      ) : activities.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', padding: '16px 0' }}>
          {t('activities.empty')}
        </div>
      ) : (
        activities.map((a) => (
          <ActivityItem
            key={a.id}
            activity={a}
            onPin={handlePin}
            onComplete={handleComplete}
            onDelete={handleDelete}
          />
        ))
      )}
    </div>
  )
}
