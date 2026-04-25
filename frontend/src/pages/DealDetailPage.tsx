import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { dealsApi, type Deal, type DealNote, type DealDocument, DEAL_STATUS_LABELS, DEAL_STATUSES } from '../api/deals'
import { tasksApi, type Task, PRIORITY_LABELS, STATUS_LABELS } from '../api/tasks'
import StarButton from '../components/common/StarButton'
import AiAssistantPanel from '../components/ai/AiAssistantPanel'
import ResourceMatchModal from '../components/ai/ResourceMatchModal'
import TranscriptModal from '../components/ai/TranscriptModal'
import CustomFieldsRenderer from '../components/common/CustomFieldsRenderer'
import type { CustomFieldValues } from '../api/customFields'
import ActivityTimeline from '../components/common/ActivityTimeline'
import DealItemsTable from '../components/deals/DealItemsTable'
import { useCurrencyStore, formatAmount } from '../stores/currencyStore'

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<Deal['status'], string> = {
  new_lead:    'bg-blue-100 text-blue-700',
  discovery:   'bg-purple-100 text-purple-700',
  proposal:    'bg-yellow-100 text-yellow-800',
  negotiation: 'bg-orange-100 text-orange-700',
  signed:      'bg-green-100 text-green-700',
  active:      'bg-emerald-100 text-emerald-700',
  closed:      'bg-gray-100 text-gray-600',
  lost:        'bg-red-100 text-red-700',
}

function StatusBadge({ status }: { status: Deal['status'] }) {
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {DEAL_STATUS_LABELS[status]}
    </span>
  )
}

// ─── Priority badge ───────────────────────────────────────────────────────────

const TASK_PRIORITY_COLORS: Record<Task['priority'], string> = {
  low:    'bg-gray-100 text-gray-600',
  medium: 'bg-yellow-100 text-yellow-800',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

function PriorityBadge({ priority }: { priority: Task['priority'] }) {
  const color = TASK_PRIORITY_COLORS[priority] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

// ─── Field row ────────────────────────────────────────────────────────────────

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-[var(--border)] last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
        {label}
      </span>
      <span className="text-sm text-[var(--text)]">{children}</span>
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'items' | 'tasks' | 'documents' | 'history' | 'timeline'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Documents Panel ─────────────────────────────────────────────────────────

interface DocumentsPanelProps {
  documents: DealDocument[]
  loading: boolean
  uploading: boolean
  fileInputRef: React.RefObject<HTMLInputElement | null>
  onMount: () => void
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDelete: (docId: number) => void
}

function DocumentsPanel({ documents, loading, uploading, fileInputRef, onMount, onUpload, onDelete }: DocumentsPanelProps) {
  useEffect(() => { onMount() }, [])

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-[var(--text)]">
          {loading ? 'Загрузка...' : `${documents.length} ${documents.length === 1 ? 'документ' : 'документов'}`}
        </span>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--accent)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {uploading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Загрузка...
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Загрузить файл
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={onUpload}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2 text-[var(--text-secondary)]">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p className="text-sm">Нет документов. Загрузите первый файл.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              {/* File icon */}
              <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>

              {/* Meta */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text)] truncate">{doc.name}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {formatFileSize(doc.size)}
                  {doc.uploaded_by_name && <> · {doc.uploaded_by_name}</>}
                  {' · '}{new Date(doc.created_at).toLocaleDateString('ru-RU')}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {doc.url && (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors"
                    title="Скачать"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                  </a>
                )}
                <button
                  onClick={() => onDelete(doc.id)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--bg-hover)] transition-colors"
                  title="Удалить"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currency = useCurrencyStore(s => s.currency)
  const rate = useCurrencyStore(s => s.rate)

  const [deal, setDeal] = useState<Deal | null>(null)
  const [notes, setNotes] = useState<DealNote[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [documents, setDocuments] = useState<DealDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Deal>>({})
  const [saving, setSaving] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [matchOpen, setMatchOpen] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [customFields, setCustomFields] = useState<CustomFieldValues>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    const dealId = Number(id)
    Promise.all([
      dealsApi.get(dealId),
      dealsApi.notes.list(dealId),
      tasksApi.list({ linked_deal: String(dealId), page_size: '100' }),
    ])
      .then(([d, n, t]) => {
        setDeal(d)
        setCustomFields(d.custom_fields ?? {})
        setNotes(n)
        setTasks(t.results)
      })
      .finally(() => setLoading(false))
  }, [id])

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteText.trim() || !deal) return
    setSubmitting(true)
    try {
      const note = await dealsApi.notes.create(deal.id, noteText.trim())
      setNotes([note, ...notes])
      setNoteText('')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteNote = async (noteId: number) => {
    if (!deal) return
    await dealsApi.notes.delete(deal.id, noteId)
    setNotes(notes.filter((n) => n.id !== noteId))
  }

  const handleDeleteDeal = async () => {
    if (!deal) return
    const confirmed = window.confirm(`Удалить сделку "${deal.title}"? Это действие необратимо.`)
    if (!confirmed) return
    await dealsApi.delete(deal.id)
    navigate('/deals')
  }

  const handleCustomFieldChange = async (patch: CustomFieldValues) => {
    if (!deal) return
    const updated = await dealsApi.update(deal.id, { custom_fields: patch } as Partial<Deal>)
    setCustomFields(updated.custom_fields ?? {})
  }

  const handleEdit = () => {
    if (!deal) return
    setEditForm({
      title: deal.title,
      status: deal.status,
      value_usd: deal.value_usd,
      probability: deal.probability,
      team_size_needed: deal.team_size_needed,
      expected_close_date: deal.expected_close_date ?? '',
      description: deal.description,
    })
    setIsEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!deal) return
    setSaving(true)
    try {
      const updated = await dealsApi.update(deal.id, editForm)
      setDeal(updated)
      setIsEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const loadDocuments = async () => {
    if (!deal) return
    setDocsLoading(true)
    try {
      const docs = await dealsApi.documents.list(deal.id)
      setDocuments(docs)
    } finally {
      setDocsLoading(false)
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !deal) return
    setUploading(true)
    try {
      const doc = await dealsApi.documents.upload(deal.id, file)
      setDocuments((prev) => [doc, ...prev])
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteDoc = async (docId: number) => {
    if (!deal) return
    if (!window.confirm('Удалить документ?')) return
    await dealsApi.documents.delete(deal.id, docId)
    setDocuments((prev) => prev.filter((d) => d.id !== docId))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-[var(--text-secondary)]">
        Загрузка...
      </div>
    )
  }
  if (!deal) {
    return <div className="text-[var(--danger)] p-4">Сделка не найдена</div>
  }

  const formattedValue = formatAmount(deal.value_usd, deal.value_rub, currency, rate)

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview',   label: 'Обзор' },
    { id: 'items',      label: 'Позиции', count: deal.items?.length || 0 },
    { id: 'timeline',   label: 'Активности' },
    { id: 'tasks',      label: 'Задачи', count: tasks.length },
    { id: 'documents',  label: 'Документы' },
    { id: 'history',    label: 'История', count: notes.length },
  ]

  return (
    <div className="flex flex-col gap-6 h-full">

      {/* ── Edit Modal ── */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setIsEditing(false)}>
          <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] shadow-xl w-full max-w-lg mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[var(--text)]">Редактировать сделку</h2>
              <button onClick={() => setIsEditing(false)} className="text-[var(--text-secondary)] hover:text-[var(--text)] text-lg leading-none">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">Название</label>
                <input value={editForm.title ?? ''} onChange={(e) => setEditForm(f => ({...f, title: e.target.value}))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">Статус</label>
                  <select value={editForm.status ?? ''} onChange={(e) => setEditForm(f => ({...f, status: e.target.value as Deal['status']}))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]">
                    {DEAL_STATUSES.map(s => <option key={s} value={s}>{DEAL_STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">Вероятность (%)</label>
                  <input type="number" min={0} max={100} value={editForm.probability ?? ''} onChange={(e) => setEditForm(f => ({...f, probability: Number(e.target.value)}))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">Сумма ({currency})</label>
                  <input type="number" value={editForm.value_usd ?? ''} onChange={(e) => setEditForm(f => ({...f, value_usd: e.target.value}))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">Размер команды</label>
                  <input type="number" min={1} value={editForm.team_size_needed ?? ''} onChange={(e) => setEditForm(f => ({...f, team_size_needed: Number(e.target.value)}))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">Дата закрытия</label>
                <input type="date" value={editForm.expected_close_date ?? ''} onChange={(e) => setEditForm(f => ({...f, expected_close_date: e.target.value}))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">Описание</label>
                <textarea rows={3} value={editForm.description ?? ''} onChange={(e) => setEditForm(f => ({...f, description: e.target.value}))}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] px-3 py-2 text-sm resize-none focus:outline-none focus:border-[var(--accent)]" />
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">Отмена</button>
              <button onClick={handleSaveEdit} disabled={saving}
                className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-medium">
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm">
          <Link to="/deals" className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
            Сделки
          </Link>
          <span className="text-[var(--text-secondary)]">/</span>
          <span className="text-[var(--text)] font-medium truncate max-w-[240px]">{deal.title}</span>
          <StarButton entityType="deal" entityId={deal.id} size={16} />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAiOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 transition-opacity"
            title="AI ассистент"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/>
            </svg>
            AI
          </button>
          <button
            onClick={() => setMatchOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--text)] border border-[var(--border)] hover:bg-[var(--bg-hover)]"
            title="Подбор команды"
          >
            👥 Match
          </button>
          <button
            onClick={() => setTranscriptOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--text)] border border-[var(--border)] hover:bg-[var(--bg-hover)]"
            title="Транскрипт встречи"
          >
            🎙 Transcript
          </button>
          <button
            onClick={() => navigate('/deals')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            ← Назад
          </button>
          <button
            onClick={handleDeleteDeal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white bg-[var(--danger)] hover:opacity-90 transition-opacity"
          >
            Удалить
          </button>
          <button
            onClick={handleEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
          >
            Редактировать
          </button>
        </div>
      </div>

      <AiAssistantPanel dealId={deal.id} open={aiOpen} onClose={() => setAiOpen(false)} />
      <ResourceMatchModal dealId={deal.id} open={matchOpen} onClose={() => setMatchOpen(false)} />
      <TranscriptModal clientId={deal.client?.id} dealId={deal.id} open={transcriptOpen} onClose={() => setTranscriptOpen(false)} />

      {/* ── Two-panel body ── */}
      <div className="flex gap-5 items-start flex-1 min-h-0">

        {/* ── Left panel ── */}
        <div className="w-80 shrink-0 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">

          {/* Icon + title + badge */}
          <div className="p-5 border-b border-[var(--border)]">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: 'var(--accent)', opacity: 1 }}>
              {/* Briefcase icon */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                <line x1="12" y1="12" x2="12" y2="12"/>
                <path d="M12 12h.01"/>
              </svg>
            </div>
            <h1 className="text-base font-semibold text-[var(--text)] leading-snug mb-2">{deal.title}</h1>
            <StatusBadge status={deal.status} />
          </div>

          {/* Field rows */}
          <div className="px-5">
            {deal.client && (
              <FieldRow label="Клиент">
                <Link
                  to={`/clients/${deal.client.id}`}
                  className="text-[var(--accent)] hover:underline"
                >
                  {deal.client.name}
                </Link>
              </FieldRow>
            )}
            <FieldRow label="Сумма">
              <span className="font-semibold text-[var(--accent)]">{formattedValue}</span>
            </FieldRow>
            {deal.assigned_to && (
              <FieldRow label="Ответственный">
                {deal.assigned_to.full_name}
              </FieldRow>
            )}
            {deal.probability != null && (
              <FieldRow label="Вероятность">
                {deal.probability}%
              </FieldRow>
            )}
            {deal.expected_close_date && (
              <FieldRow label="Ожидаемое закрытие">
                {new Date(deal.expected_close_date).toLocaleDateString('ru-RU')}
              </FieldRow>
            )}
            {deal.team_size_needed != null && (
              <FieldRow label="Размер команды">
                {deal.team_size_needed} чел.
              </FieldRow>
            )}
          </div>

          {/* Created / Updated */}
          <div className="px-5 py-4 border-t border-[var(--border)] mt-1 space-y-1">
            <p className="text-xs text-[var(--text-secondary)]">
              Создано: {new Date(deal.created_at).toLocaleDateString('ru-RU')}
            </p>
            {deal.updated_at && (
              <p className="text-xs text-[var(--text-secondary)]">
                Обновлено: {new Date(deal.updated_at).toLocaleDateString('ru-RU')}
              </p>
            )}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 min-w-0 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] flex flex-col">

          {/* Tab bar */}
          <div className="flex border-b border-[var(--border)] px-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-[var(--accent)] text-[var(--text)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]'
                }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-semibold ${
                    activeTab === tab.id
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto p-5">

            {/* ── Overview ── */}
            {activeTab === 'overview' && (
              <>
              <div className="flex gap-5 flex-wrap">
                {/* Finance */}
                <div className="flex-1 min-w-[200px]">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
                    Финансы
                  </p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-[var(--text-secondary)] mb-0.5">Сумма сделки</p>
                      <p className="text-2xl font-bold text-[var(--accent)]">{formattedValue}</p>
                    </div>
                    {deal.tech_requirements && deal.tech_requirements.length > 0 && (
                      <div>
                        <p className="text-xs text-[var(--text-secondary)] mb-1.5">Технологии</p>
                        <div className="flex flex-wrap gap-1.5">
                          {deal.tech_requirements.map((tech, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--bg-hover)] text-[var(--text)]"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="flex-1 min-w-[200px]">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-3">
                    Описание
                  </p>
                  {deal.description ? (
                    <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">
                      {deal.description}
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">—</p>
                  )}
                </div>
              </div>

              {/* Custom Fields */}
              <div className="mt-5 pt-4 border-t border-[var(--border)]">
                <CustomFieldsRenderer
                  entity="deal"
                  entityId={deal.id}
                  values={customFields}
                  onChange={handleCustomFieldChange}
                />
              </div>
              </>
            )}

            {/* ── Items (Deal positions) ── */}
            {activeTab === 'items' && (
              <DealItemsTable
                dealId={deal.id}
                onUpdate={async () => {
                  const updated = await dealsApi.get(deal.id)
                  setDeal(updated)
                }}
              />
            )}

            {/* ── Tasks ── */}
            {activeTab === 'tasks' && (
              <div className="space-y-2">
                {tasks.length === 0 && (
                  <p className="text-sm text-[var(--text-secondary)]">Задач пока нет.</p>
                )}
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between gap-3 p-4 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.is_overdue ? 'text-[var(--danger)]' : 'text-[var(--text)]'}`}>
                        {task.title}
                      </p>
                      {task.deadline && (
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                          До {new Date(task.deadline).toLocaleDateString('ru-RU')}
                          {task.is_overdue && (
                            <span className="ml-1.5 text-[var(--danger)] font-medium">просрочено</span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <PriorityBadge priority={task.priority} />
                      <span className="text-xs text-[var(--text-secondary)]">{STATUS_LABELS[task.status]}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Documents ── */}
            {activeTab === 'documents' && (
              <DocumentsPanel
                documents={documents}
                loading={docsLoading}
                uploading={uploading}
                fileInputRef={fileInputRef}
                onMount={loadDocuments}
                onUpload={handleUpload}
                onDelete={handleDeleteDoc}
              />
            )}

            {/* ── Activity Timeline ── */}
            {activeTab === 'timeline' && deal && (
              <ActivityTimeline entity="deal" entityId={deal.id} />
            )}

            {/* ── History (notes) ── */}
            {activeTab === 'history' && (
              <div>
                <form onSubmit={handleAddNote} className="mb-5">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Добавить заметку..."
                    rows={3}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-3 py-2 resize-none focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={submitting || !noteText.trim()}
                    className="mt-2 bg-[var(--accent)] text-white text-sm font-medium px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {submitting ? '...' : 'Добавить'}
                  </button>
                </form>

                <div className="space-y-3">
                  {notes.length === 0 && (
                    <p className="text-sm text-[var(--text-secondary)]">Заметок пока нет.</p>
                  )}
                  {notes.map((note) => (
                    <div key={note.id} className="border border-[var(--border)] rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs text-[var(--text-secondary)]">
                          {note.author?.full_name} · {new Date(note.created_at).toLocaleString('ru-RU')}
                        </span>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors"
                        >
                          Удалить
                        </button>
                      </div>
                      <p className="text-sm text-[var(--text)] whitespace-pre-wrap">{note.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
