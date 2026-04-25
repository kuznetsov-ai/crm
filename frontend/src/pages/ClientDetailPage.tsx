import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { clientsApi, type Client, type Contact, type ClientDocument, type ClientNote, type NoteKind, type ContactRole, CONTACT_ROLE_LABELS } from '../api/clients'
import CustomFieldsRenderer from '../components/common/CustomFieldsRenderer'
import type { CustomFieldValues } from '../api/customFields'
import { rateCardsApi, type RateCard, type RateCardRole, type RateCardUnit } from '../api/rateCards'
import StarButton from '../components/common/StarButton'
import InlineEdit from '../components/common/InlineEdit'
import RiskBadge from '../components/clients/RiskBadge'
import SyncPanel from '../components/clients/SyncPanel'
import CandidateMatchModal from '../components/ai/CandidateMatchModal'
import TranscriptModal from '../components/ai/TranscriptModal'
import { tasksApi, type Task, PRIORITY_LABELS, PRIORITY_COLORS, STATUS_LABELS } from '../api/tasks'
import { dealsApi, type Deal, DEAL_STATUS_LABELS } from '../api/deals'
import { useCurrencyStore, formatAmount } from '../stores/currencyStore'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ActivityTimeline from '../components/common/ActivityTimeline'

type Tab = 'overview' | 'contacts' | 'deals' | 'tasks' | 'documents' | 'notes' | 'rates' | 'timeline'

const STATUS_BADGE: Record<Client['status'], { bg: string; text: string; label: string }> = {
  lead:     { bg: 'bg-blue-500/15',   text: 'text-blue-400',   label: 'Лид' },
  prospect: { bg: 'bg-purple-500/15', text: 'text-purple-400', label: 'Потенциальный' },
  active:   { bg: 'bg-green-500/15',  text: 'text-green-400',  label: 'Активный' },
  paused:   { bg: 'bg-yellow-500/15', text: 'text-yellow-400', label: 'На паузе' },
  churned:  { bg: 'bg-red-500/15',    text: 'text-red-400',    label: 'Потерян' },
}

const PRIORITY_BADGE: Record<Task['priority'], { bg: string; text: string; label: string }> = {
  low:    { bg: 'bg-[var(--bg-hover)]',   text: 'text-[var(--text-secondary)]', label: 'Низкий' },
  medium: { bg: 'bg-blue-500/15',         text: 'text-blue-400',                label: 'Средний' },
  high:   { bg: 'bg-orange-500/15',       text: 'text-orange-400',              label: 'Высокий' },
  urgent: { bg: 'bg-red-500/15',          text: 'text-red-400',                 label: 'Срочный' },
}

const TASK_STATUS_LABEL: Record<Task['status'], string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  done: 'Готово',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

// ── Left Panel ────────────────────────────────────────────────────────────────

function LeftPanel({ client, onPatch }: { client: Client; onPatch: (patch: Partial<Client>) => Promise<void> }) {
  const { t } = useTranslation()
  const badge = STATUS_BADGE[client.status]

  const SIZE_OPTIONS = [
    { value: '1-10', label: '1–10' },
    { value: '11-50', label: '11–50' },
    { value: '51-200', label: '51–200' },
    { value: '200+', label: '200+' },
  ]
  const BUDGET_OPTIONS = [
    { value: 'small', label: 'Up to $5K/mo' },
    { value: 'medium', label: '$5K–$20K/mo' },
    { value: 'large', label: '$20K–$100K/mo' },
    { value: 'enterprise', label: '$100K+/mo' },
  ]

  const fields: { label: string; value: React.ReactNode }[] = [
    {
      label: t('clientDetail.fields.company'),
      value: <InlineEdit kind="select" options={SIZE_OPTIONS} value={client.company_size || ''} onSave={(v) => onPatch({ company_size: v })} />,
    },
    {
      label: t('clientDetail.fields.industry'),
      value: <InlineEdit value={client.industry || ''} onSave={(v) => onPatch({ industry: v })} placeholder="Retail / Finance / ..." />,
    },
    {
      label: t('clientDetail.fields.country'),
      value: <InlineEdit value={client.country || ''} onSave={(v) => onPatch({ country: v })} placeholder="Italy" />,
    },
    {
      label: t('clientDetail.fields.budget'),
      value: <InlineEdit kind="select" options={BUDGET_OPTIONS} value={client.budget_range || ''} onSave={(v) => onPatch({ budget_range: v })} />,
    },
    {
      label: t('clientDetail.fields.website'),
      value: client.website
        ? (
          <div className="flex items-center gap-2">
            <a href={client.website} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline break-all">{client.website}</a>
            <InlineEdit value={client.website || ''} onSave={(v) => onPatch({ website: v })} className="text-[10px] text-[var(--text-secondary)] whitespace-nowrap" emptyLabel="✎" />
          </div>
        )
        : <InlineEdit value="" onSave={(v) => onPatch({ website: v })} placeholder="https://..." emptyLabel="+ добавить" />,
    },
    {
      label: t('clientDetail.fields.stack'),
      value: (
        <InlineEdit
          value={client.tech_stack?.join(', ') || ''}
          onSave={async (v) => onPatch({ tech_stack: v.split(',').map((s) => s.trim()).filter(Boolean) })}
          placeholder="React, Node.js"
          emptyLabel="+ добавить"
        />
      ),
    },
    { label: t('clientDetail.fields.manager'), value: client.assigned_to?.full_name || '—' },
    { label: t('clientDetail.fields.created'), value: formatDate(client.created_at) },
  ]

  return (
    <div className="w-72 shrink-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl flex flex-col">
      {/* Header block */}
      <div className="p-5 border-b border-[var(--border)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <InlineEdit
              value={client.name}
              onSave={(v) => onPatch({ name: v })}
              className="font-semibold text-[var(--text)] text-sm leading-tight break-words"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <InlineEdit
            kind="select"
            options={[
              { value: 'lead', label: 'Лид' },
              { value: 'prospect', label: 'Потенциальный' },
              { value: 'active', label: 'Активный' },
              { value: 'paused', label: 'На паузе' },
              { value: 'churned', label: 'Потерян' },
            ]}
            value={client.status}
            onSave={(v) => onPatch({ status: v as Client['status'] })}
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
          />
          <RiskBadge level={client.risk_level ?? 'low'} score={client.risk_score} />
        </div>
      </div>

      {/* Legal / tax fields */}
      <div className="p-5 border-b border-[var(--border)] space-y-3">
        <div>
          <div className="text-[10px] font-semibold tracking-wider text-[var(--text-secondary)] mb-1">ИНН</div>
          <InlineEdit
            value={client.tax_id || ''}
            onSave={async (v) => onPatch({ tax_id: v })}
            placeholder="10 или 12 цифр"
            emptyLabel="+ добавить"
            className="text-sm font-mono text-[var(--text)]"
          />
          {client.tax_id && (
            <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
              {client.tax_id_country || 'RU'} · {client.tax_id.length === 12 ? 'ИП' : client.tax_id.length === 10 ? 'ЮЛ' : 'other'}
            </div>
          )}
        </div>
        {(client.risk_factors?.length ?? 0) > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-[var(--text-secondary)] font-medium">
              Факторы риска ({client.risk_factors?.length})
            </summary>
            <ul className="mt-1 space-y-1">
              {client.risk_factors?.map((f, i) => (
                <li key={i} className="text-[var(--text)]">
                  <span className="font-mono text-red-500">+{f.weight}</span> — {f.detail}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto">
        {fields.map(({ label, value }) => (
          <div key={label} className="px-5 py-3 border-b border-[var(--border)] last:border-0">
            <div className="text-[10px] font-semibold tracking-wider text-[var(--text-secondary)] mb-1">{label}</div>
            <div className="text-sm text-[var(--text)]">{value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ client, deals, tasks }: { client: Client; deals: Deal[]; tasks: Task[] }) {
  const openDeals = deals.filter(d => !['closed', 'lost'].includes(d.status))

  return (
    <div className="space-y-6">
      {/* Description */}
      <section>
        <h3 className="text-[10px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase mb-3">Описание</h3>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4">
          <p className="text-sm text-[var(--text)] whitespace-pre-wrap leading-relaxed">{client.description || '—'}</p>
        </div>
      </section>

      {/* Activity stats */}
      <section>
        <h3 className="text-[10px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase mb-3">Активность</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Всего сделок',    value: deals.length },
            { label: 'Открытых сделок', value: openDeals.length },
            { label: 'Задач',           value: tasks.length },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-[var(--text)] mb-1">{value}</div>
              <div className="text-xs text-[var(--text-secondary)]">{label}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Contact Card (sortable) ────────────────────────────────────────────────────

const ROLE_COLORS: Record<ContactRole, string> = {
  decision_maker: 'bg-red-100 text-red-700',
  manager: 'bg-blue-100 text-blue-700',
  secretary: 'bg-purple-100 text-purple-700',
  other: 'bg-gray-100 text-gray-600',
}

function SortableContactCard({ contact, onDelete }: { contact: Contact; onDelete: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: contact.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style}
      className={`bg-[var(--bg-card)] border border-[var(--border)] rounded-lg flex items-start gap-0 transition-all
        ${isDragging ? 'opacity-30 scale-95 shadow-lg' : 'hover:border-[var(--accent)]/30'}`}>
      {/* Drag handle */}
      <div {...attributes} {...listeners}
        className="w-7 flex items-center justify-center py-4 cursor-grab active:cursor-grabbing text-[var(--border)] hover:text-[var(--text-secondary)] shrink-0 border-r border-[var(--border)] self-stretch">
        <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
          <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
          <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
          <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
        </svg>
      </div>

      <div className="flex items-start gap-3 flex-1 p-4">
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-[var(--accent)]/15 flex items-center justify-center shrink-0">
          <span className="text-sm font-semibold text-[var(--accent)]">{getInitials(contact.full_name)}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm text-[var(--text)]">{contact.full_name}</span>
            {contact.role && contact.role !== 'other' && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${ROLE_COLORS[contact.role]}`}>
                {CONTACT_ROLE_LABELS[contact.role]}
              </span>
            )}
            {contact.is_primary && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--accent)]/15 text-[var(--accent)]">
                Основной
              </span>
            )}
          </div>
          {contact.position && <div className="text-xs text-[var(--text-secondary)] mb-1.5">{contact.position}</div>}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {contact.email && <a href={`mailto:${contact.email}`} className="text-xs text-[var(--accent)] hover:underline">✉ {contact.email}</a>}
            {contact.phone && <a href={`tel:${contact.phone}`} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)]">📞 {contact.phone}</a>}
            {contact.telegram && <span className="text-xs text-[var(--text-secondary)]">✈ {contact.telegram}</span>}
            {contact.whatsapp && <span className="text-xs text-[var(--text-secondary)]">💬 {contact.whatsapp}</span>}
            {contact.linkedin && <a href={contact.linkedin} target="_blank" rel="noreferrer" className="text-xs text-[var(--accent)] hover:underline">in LinkedIn</a>}
          </div>
        </div>

        <button onClick={() => onDelete(contact.id)}
          className="text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors shrink-0 p-1" title="Удалить">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Contacts Tab ──────────────────────────────────────────────────────────────

const EMPTY_CONTACT = { first_name: '', last_name: '', role: 'other' as ContactRole, position: '', email: '', phone: '', telegram: '', whatsapp: '', linkedin: '', is_primary: false }

function ContactsTab({ clientId, contacts: initialContacts }: { clientId: number; contacts: Contact[] }) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_CONTACT)
  const [saving, setSaving] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setContacts(prev => {
      const oi = prev.findIndex(c => c.id === Number(active.id))
      const ni = prev.findIndex(c => c.id === Number(over.id))
      return arrayMove(prev, oi, ni)
    })
  }

  const handleAdd = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!form.first_name.trim()) return
    setSaving(true)
    try {
      const created = await clientsApi.contacts.create(clientId, form)
      setContacts(prev => [...prev, created])
      setForm(EMPTY_CONTACT)
      setShowForm(false)
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Удалить контакт?')) return
    await clientsApi.contacts.delete(clientId, id)
    setContacts(prev => prev.filter(c => c.id !== id))
  }

  const inputCls = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)]'

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-[var(--text-secondary)]">{contacts.length} контактов</span>
        <button onClick={() => setShowForm(v => !v)}
          className="bg-[var(--accent)] text-white text-sm px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity">
          + Добавить контакт
        </button>
      </div>

      {/* Add contact form */}
      {showForm && (
        <form onSubmit={handleAdd} className="mb-4 p-4 bg-[var(--bg-hover)] rounded-lg border border-[var(--border)] space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Имя *</label>
              <input value={form.first_name} onChange={e => setForm(f => ({...f, first_name: e.target.value}))} required className={inputCls} placeholder="Иван"/>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Фамилия</label>
              <input value={form.last_name} onChange={e => setForm(f => ({...f, last_name: e.target.value}))} className={inputCls} placeholder="Иванов"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Роль</label>
              <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value as ContactRole}))} className={inputCls}>
                {(Object.entries(CONTACT_ROLE_LABELS) as [ContactRole, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Должность</label>
              <input value={form.position} onChange={e => setForm(f => ({...f, position: e.target.value}))} className={inputCls} placeholder="CEO"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Email</label>
              <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className={inputCls} placeholder="ivan@company.com"/>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Телефон</label>
              <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} className={inputCls} placeholder="+7 999 000 00 00"/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Telegram</label>
              <input value={form.telegram} onChange={e => setForm(f => ({...f, telegram: e.target.value}))} className={inputCls} placeholder="@username"/>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">WhatsApp</label>
              <input value={form.whatsapp} onChange={e => setForm(f => ({...f, whatsapp: e.target.value}))} className={inputCls} placeholder="+7 999 000 00 00"/>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_primary" checked={form.is_primary} onChange={e => setForm(f => ({...f, is_primary: e.target.checked}))} className="accent-[var(--accent)]"/>
            <label htmlFor="is_primary" className="text-sm text-[var(--text-secondary)]">Основной контакт</label>
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="text-sm px-3 py-1.5 border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-card)]">Отмена</button>
            <button type="submit" disabled={saving} className="text-sm px-4 py-1.5 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50">{saving ? 'Сохраняем...' : 'Добавить'}</button>
          </div>
        </form>
      )}

      {contacts.length === 0 && !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)]">
          <span className="text-3xl mb-2">👤</span>
          <span className="text-sm">Нет контактов. Добавьте первый.</span>
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={contacts.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {contacts.map(c => (
                <SortableContactCard key={c.id} contact={c} onDelete={handleDelete} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}

// ── Deals Tab ─────────────────────────────────────────────────────────────────

function DealsTab({ deals }: { deals: Deal[] }) {
  const navigate = useNavigate()
  const currency = useCurrencyStore(s => s.currency)
  const rate = useCurrencyStore(s => s.rate)

  if (!deals.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)]">
        <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006-3.75 3.75m0 0-3.75-3.75m3.75 3.75V10.5m0-4.5a48.667 48.667 0 0 0-7.5 0" />
        </svg>
        <span className="text-sm">Нет сделок</span>
      </div>
    )
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase">Название</th>
            <th className="text-left px-4 py-3 text-[10px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase">Статус</th>
            <th className="text-right px-4 py-3 text-[10px] font-semibold tracking-wider text-[var(--text-secondary)] uppercase">Сумма</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => (
            <tr
              key={deal.id}
              className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-hover)] cursor-pointer transition-colors"
              onClick={() => navigate(`/deals/${deal.id}`)}
            >
              <td className="px-4 py-3 text-sm text-[var(--text)] font-medium">{deal.title}</td>
              <td className="px-4 py-3">
                <span className="text-xs text-[var(--text-secondary)]">
                  {DEAL_STATUS_LABELS[deal.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-[var(--text)] text-right font-medium">
                {formatAmount(deal.value_usd, deal.value_rub, currency, rate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────

const STATUS_CYCLE: Task['status'][] = ['todo', 'in_progress', 'done']
const PRIORITY_CYCLE: Task['priority'][] = ['low', 'medium', 'high', 'urgent']
const STATUS_DOT: Record<Task['status'], string> = { todo: 'bg-gray-300', in_progress: 'bg-yellow-400', done: 'bg-green-400' }

function TasksTab({ tasks: initial }: { tasks: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initial)
  const [updating, setUpdating] = useState<Set<number>>(new Set())

  const cycle = async (task: Task, field: 'status' | 'priority') => {
    if (updating.has(task.id)) return
    setUpdating(p => new Set(p).add(task.id))
    try {
      const next = field === 'status'
        ? STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length]
        : PRIORITY_CYCLE[(PRIORITY_CYCLE.indexOf(task.priority) + 1) % PRIORITY_CYCLE.length]
      const updated = await tasksApi.update(task.id, { [field]: next })
      setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
    } finally { setUpdating(p => { const s = new Set(p); s.delete(task.id); return s }) }
  }

  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-[var(--text-secondary)]">
        <span className="text-3xl mb-2">✅</span>
        <span className="text-sm">Нет задач</span>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {tasks.map(task => {
        const isDone = task.status === 'done'
        const isUpdating = updating.has(task.id)
        return (
          <div key={task.id} className={`bg-[var(--bg-card)] border rounded-lg px-4 py-3 flex items-center gap-3 transition-colors
            ${task.is_overdue && !isDone ? 'border-red-200' : 'border-[var(--border)]'}`}>
            {/* Status button */}
            <button onClick={() => cycle(task, 'status')} disabled={isUpdating} title="Сменить статус"
              className={`w-4 h-4 rounded-full shrink-0 border-2 transition-colors cursor-pointer disabled:opacity-50
                ${task.status === 'done' ? 'bg-green-400 border-green-400' : task.status === 'in_progress' ? 'bg-yellow-400 border-yellow-400' : 'bg-transparent border-gray-300 hover:border-[var(--accent)]'}`}
            />
            <div className="flex-1 min-w-0">
              <span className={`text-sm font-medium ${isDone ? 'line-through text-[var(--text-secondary)]' : 'text-[var(--text)]'}`}>
                {task.title}
              </span>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <button onClick={() => cycle(task, 'status')} disabled={isUpdating} title="Сменить статус"
                  className={`text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent)] cursor-pointer flex items-center gap-1 disabled:opacity-50`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[task.status]}`}/>
                  {STATUS_LABELS[task.status]}
                </button>
                {task.deadline && (
                  <span className={`text-[10px] ${task.is_overdue && !isDone ? 'text-red-400 font-medium' : 'text-[var(--text-secondary)]'}`}>
                    {new Date(task.deadline).toLocaleDateString('ru-RU')}
                  </span>
                )}
              </div>
            </div>
            {/* Clickable priority */}
            <button onClick={() => cycle(task, 'priority')} disabled={isUpdating} title="Сменить приоритет"
              className={`text-xs font-semibold px-2 py-0.5 rounded cursor-pointer hover:opacity-70 transition-opacity disabled:opacity-40 ${PRIORITY_COLORS[task.priority]}`}>
              {PRIORITY_LABELS[task.priority]}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Documents Tab ─────────────────────────────────────────────────────────────

interface DocumentsTabProps {
  clientId: number
}

function DocumentsTab({ clientId }: DocumentsTabProps) {
  const { t } = useTranslation()
  const [documents, setDocuments] = useState<ClientDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setLoading(true)
    clientsApi.documents.list(clientId)
      .then(setDocuments)
      .finally(() => setLoading(false))
  }, [clientId])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const doc = await clientsApi.documents.upload(clientId, file)
      setDocuments((prev) => [doc, ...prev])
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async (docId: number) => {
    if (!window.confirm(t('clientDetail.documents.deleteConfirm'))) return
    await clientsApi.documents.delete(clientId, docId)
    setDocuments((prev) => prev.filter((d) => d.id !== docId))
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-[var(--text)]">
          {loading ? t('common.loading') : t('clientDetail.documents.count', { count: documents.length })}
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
              {t('clientDetail.documents.uploading')}
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              {t('clientDetail.documents.upload')}
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-[var(--text-secondary)]">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p className="text-sm">{t('clientDetail.documents.empty')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => {
            const isImage = /\.(png|jpe?g|gif|webp|bmp|svg|heic|avif)$/i.test(doc.name)
            return (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              {/* Thumbnail for images, icon otherwise */}
              {isImage && doc.url ? (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-[var(--bg-hover)] block"
                >
                  <img src={doc.url} alt={doc.name} className="w-full h-full object-cover" loading="lazy" />
                </a>
              ) : (
                <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--bg-hover)] flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
              )}

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
                  onClick={() => handleDelete(doc.id)}
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
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Notes / Knowledge Base Tab ────────────────────────────────────────────────

const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  note: 'Заметка',
  meeting: 'Встреча',
  call: 'Звонок',
  transcript: 'Транскрипт',
  decision: 'Решение',
}

const NOTE_KIND_COLORS: Record<NoteKind, string> = {
  note: 'bg-[var(--bg-hover)] text-[var(--text-secondary)]',
  meeting: 'bg-blue-500/15 text-blue-500',
  call: 'bg-green-500/15 text-green-500',
  transcript: 'bg-purple-500/15 text-purple-500',
  decision: 'bg-orange-500/15 text-orange-500',
}

function NotesTab({ clientId }: { clientId: number }) {
  const [notes, setNotes] = useState<ClientNote[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<{ kind: NoteKind; title: string; body: string }>({
    kind: 'note',
    title: '',
    body: '',
  })

  const reload = () => {
    setLoading(true)
    clientsApi.notes.list(clientId).then(setNotes).finally(() => setLoading(false))
  }

  useEffect(() => { reload() }, [clientId])

  const submit = async () => {
    if (!form.body.trim()) return
    setCreating(true)
    try {
      const newNote = await clientsApi.notes.create(clientId, form)
      setNotes((prev) => [newNote, ...prev])
      setForm({ kind: 'note', title: '', body: '' })
      setShowForm(false)
    } finally {
      setCreating(false)
    }
  }

  const togglePin = async (n: ClientNote) => {
    const updated = await clientsApi.notes.update(clientId, n.id, { pinned: !n.pinned })
    setNotes((prev) => prev.map((x) => (x.id === n.id ? updated : x)).sort((a, b) => {
      if (a.pinned === b.pinned) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      return a.pinned ? -1 : 1
    }))
  }

  const remove = async (n: ClientNote) => {
    if (!window.confirm('Удалить запись?')) return
    await clientsApi.notes.delete(clientId, n.id)
    setNotes((prev) => prev.filter((x) => x.id !== n.id))
  }

  const inputCls = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)]'

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-[var(--text)]">
          {loading ? 'Загрузка...' : `${notes.length} записей`}
        </span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
        >
          {showForm ? 'Закрыть' : '+ Добавить'}
        </button>
      </div>

      {/* New note form */}
      {showForm && (
        <div className="mb-4 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Тип</label>
              <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value as NoteKind }))} className={inputCls}>
                {(Object.keys(NOTE_KIND_LABELS) as NoteKind[]).map((k) => (
                  <option key={k} value={k}>{NOTE_KIND_LABELS[k]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Заголовок</label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} className={inputCls} placeholder="Кратко: о чём" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Текст *</label>
            <textarea rows={5} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} className={`${inputCls} resize-y`} placeholder="Содержание заметки, транскрипт, решение..." />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">Отмена</button>
            <button onClick={submit} disabled={creating || !form.body.trim()} className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50">
              {creating ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-[var(--text-secondary)]">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
            <line x1="9" y1="17" x2="15" y2="17"/>
          </svg>
          <p className="text-sm">Нет записей. Добавьте первую — встречу, звонок, транскрипт.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div
              key={n.id}
              className={`rounded-lg border ${n.pinned ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5' : 'border-[var(--border)] bg-[var(--bg-card)]'} p-4`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${NOTE_KIND_COLORS[n.kind]}`}>{NOTE_KIND_LABELS[n.kind]}</span>
                  {n.title && <span className="text-sm font-medium text-[var(--text)] truncate">{n.title}</span>}
                  {n.pinned && <span className="text-[var(--accent)] text-xs">📌</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => togglePin(n)} title={n.pinned ? 'Открепить' : 'Закрепить'} className="w-7 h-7 rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors text-sm">📌</button>
                  <button onClick={() => remove(n)} title="Удалить" className="w-7 h-7 rounded-lg text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--bg-hover)] transition-colors">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ margin: 'auto' }}>
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    </svg>
                  </button>
                </div>
              </div>
              <p className="text-sm text-[var(--text)] whitespace-pre-wrap break-words">{n.body}</p>
              <div className="mt-2 text-[11px] text-[var(--text-secondary)]">
                {n.author?.full_name ?? 'Unknown'} · {new Date(n.created_at).toLocaleString('ru-RU')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Rate Cards Tab ────────────────────────────────────────────────────────────

const RATE_ROLE_OPTIONS: { value: RateCardRole; label: string }[] = [
  { value: 'ba', label: 'Business Analyst' },
  { value: 'sa', label: 'System Analyst' },
  { value: 'dev_junior', label: 'Developer — Junior' },
  { value: 'dev_middle', label: 'Developer — Middle' },
  { value: 'dev_senior', label: 'Developer — Senior' },
  { value: 'dev_lead', label: 'Developer — Lead' },
  { value: 'qa', label: 'QA Engineer' },
  { value: 'devops', label: 'DevOps' },
  { value: 'pm', label: 'Project Manager' },
  { value: 'other', label: 'Другое' },
]

function RateCardsTab({ clientId }: { clientId: number }) {
  const [cards, setCards] = useState<RateCard[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<{
    role: RateCardRole
    role_custom: string
    unit: RateCardUnit
    bill_rate_usd: string
    cost_rate_usd: string
    notes: string
  }>({
    role: 'dev_middle',
    role_custom: '',
    unit: 'monthly',
    bill_rate_usd: '',
    cost_rate_usd: '',
    notes: '',
  })

  const reload = () => {
    setLoading(true)
    rateCardsApi.list(clientId).then(setCards).finally(() => setLoading(false))
  }
  useEffect(() => { reload() }, [clientId])

  const submit = async () => {
    if (!form.bill_rate_usd) return
    setCreating(true)
    try {
      const newCard = await rateCardsApi.create(clientId, form)
      setCards((prev) => [...prev, newCard].sort((a, b) => a.role.localeCompare(b.role)))
      setForm({ role: 'dev_middle', role_custom: '', unit: 'monthly', bill_rate_usd: '', cost_rate_usd: '', notes: '' })
      setShowForm(false)
    } finally {
      setCreating(false)
    }
  }

  const remove = async (card: RateCard) => {
    if (!window.confirm('Удалить ставку?')) return
    await rateCardsApi.delete(clientId, card.id)
    setCards((prev) => prev.filter((c) => c.id !== card.id))
  }

  // Blended (average) rate across all cards — same unit aggregated
  const monthly = cards.filter((c) => c.unit === 'monthly')
  const hourly = cards.filter((c) => c.unit === 'hourly')
  const avg = (arr: RateCard[], field: 'bill_rate_usd' | 'cost_rate_usd') =>
    arr.length ? arr.reduce((s, c) => s + parseFloat(c[field]), 0) / arr.length : 0
  const blendedMonthlyBill = avg(monthly, 'bill_rate_usd')
  const blendedMonthlyCost = avg(monthly, 'cost_rate_usd')
  const blendedMonthlyMarginPct = blendedMonthlyBill > 0 ? ((blendedMonthlyBill - blendedMonthlyCost) / blendedMonthlyBill) * 100 : 0

  const inputCls = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)]'

  return (
    <div>
      {/* Summary */}
      {monthly.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
            <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Средний bill (месяц)</div>
            <div className="text-base font-bold text-[var(--text)]">${blendedMonthlyBill.toFixed(0)}</div>
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
            <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Средний cost (месяц)</div>
            <div className="text-base font-bold text-[var(--text)]">${blendedMonthlyCost.toFixed(0)}</div>
          </div>
          <div className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/5 p-3">
            <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Blended margin</div>
            <div className={`text-base font-bold ${blendedMonthlyMarginPct >= 30 ? 'text-green-500' : blendedMonthlyMarginPct >= 15 ? 'text-orange-500' : 'text-red-500'}`}>
              {blendedMonthlyMarginPct.toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-[var(--text)]">{cards.length} ставок</span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
        >
          {showForm ? 'Закрыть' : '+ Добавить'}
        </button>
      </div>

      {/* New card form */}
      {showForm && (
        <div className="mb-4 p-4 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Роль</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as RateCardRole }))} className={inputCls}>
                {RATE_ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Единица</label>
              <select value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value as RateCardUnit }))} className={inputCls}>
                <option value="monthly">В месяц</option>
                <option value="hourly">В час</option>
              </select>
            </div>
            {form.role === 'other' && (
              <div>
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Название роли</label>
                <input value={form.role_custom} onChange={(e) => setForm((f) => ({ ...f, role_custom: e.target.value }))} className={inputCls} placeholder="Data Analyst" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Bill rate USD *</label>
              <input type="number" value={form.bill_rate_usd} onChange={(e) => setForm((f) => ({ ...f, bill_rate_usd: e.target.value }))} className={inputCls} placeholder="7000" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Cost rate USD (внутренний)</label>
              <input type="number" value={form.cost_rate_usd} onChange={(e) => setForm((f) => ({ ...f, cost_rate_usd: e.target.value }))} className={inputCls} placeholder="5000" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Заметки</label>
            <input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inputCls} placeholder="Только удалённо / только EU timezones" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">Отмена</button>
            <button onClick={submit} disabled={creating || !form.bill_rate_usd} className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50">
              {creating ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </div>
        </div>
      )}

      {/* Cards list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-[var(--text-secondary)]">
          <p className="text-sm">Нет ставок. Добавьте первую, чтобы автоматически считался margin.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full">
            <thead className="bg-[var(--bg-hover)]">
              <tr>
                {['Роль', 'Единица', 'Bill', 'Cost', 'Margin $', 'Margin %', ''].map((h) => (
                  <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {cards.map((c) => (
                <tr key={c.id} className="text-sm">
                  <td className="px-3 py-2">
                    <div className="font-medium text-[var(--text)]">{c.role_label}{c.role_custom ? ` — ${c.role_custom}` : ''}</div>
                    {c.notes && <div className="text-xs text-[var(--text-secondary)]">{c.notes}</div>}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">{c.unit === 'monthly' ? 'мес' : 'час'}</td>
                  <td className="px-3 py-2 font-medium">${parseFloat(c.bill_rate_usd).toFixed(0)}</td>
                  <td className="px-3 py-2 text-[var(--text-secondary)]">${parseFloat(c.cost_rate_usd).toFixed(0)}</td>
                  <td className="px-3 py-2 font-medium">${c.margin_usd.toFixed(0)}</td>
                  <td className={`px-3 py-2 font-semibold ${c.margin_pct >= 30 ? 'text-green-500' : c.margin_pct >= 15 ? 'text-orange-500' : 'text-red-500'}`}>
                    {c.margin_pct.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => remove(c)} className="text-[var(--text-secondary)] hover:text-[var(--danger)]" title="Удалить">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ClientDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [client, setClient] = useState<Client | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [deleting, setDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Client>>({})
  const [savingEdit, setSavingEdit] = useState(false)
  const [candidateOpen, setCandidateOpen] = useState(false)
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [customFields, setCustomFields] = useState<CustomFieldValues>({})

  useEffect(() => {
    if (!id) return
    const numId = Number(id)
    Promise.all([
      clientsApi.get(numId),
      dealsApi.list({ client: id, page_size: '100' }),
      tasksApi.list({ linked_client: id, page_size: '100' }),
    ])
      .then(([c, d, t]) => {
        setClient(c)
        setCustomFields(c.custom_fields ?? {})
        setDeals(d.results)
        setTasks(t.results)
      })
      .finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    if (!client || !window.confirm(`Удалить клиента "${client.name}"?`)) return
    setDeleting(true)
    try {
      await clientsApi.delete(client.id)
      navigate('/clients')
    } finally {
      setDeleting(false)
    }
  }

  async function handleCustomFieldChange(patch: CustomFieldValues) {
    if (!client) return
    const updated = await clientsApi.update(client.id, { custom_fields: patch } as Partial<Client>)
    setCustomFields(updated.custom_fields ?? {})
  }

  function openEdit() {
    if (!client) return
    setEditForm({
      name: client.name, industry: client.industry, country: client.country,
      company_size: client.company_size, budget_range: client.budget_range,
      website: client.website, description: client.description, status: client.status,
      tech_stack: client.tech_stack,
    })
    setIsEditing(true)
  }

  async function handleSaveEdit() {
    if (!client) return
    setSavingEdit(true)
    try {
      const { data } = await import('../api/client').then(m => m.default.patch(`/clients/${client.id}/`, editForm))
      setClient(data)
      setIsEditing(false)
    } finally { setSavingEdit(false) }
  }

  async function patchClient(patch: Partial<Client>) {
    if (!client) return
    const updated = await clientsApi.update(client.id, patch)
    setClient(updated)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!client) {
    return <div className="text-[var(--danger)] p-6 text-sm">{t('clientDetail.notFound')}</div>
  }

  const openDealsCount = deals.filter(d => !['closed', 'lost'].includes(d.status)).length

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview',   label: t('clientDetail.tabs.overview') },
    { key: 'contacts',   label: t('clientDetail.tabs.contacts'), count: client.contacts_count },
    { key: 'deals',      label: t('clientDetail.tabs.deals'),    count: deals.length },
    { key: 'tasks',      label: t('clientDetail.tabs.tasks'),    count: tasks.length },
    { key: 'documents',  label: t('clientDetail.tabs.documents') },
    { key: 'notes',      label: t('clientDetail.tabs.notes') },
    { key: 'timeline',   label: t('activities.title') },
    { key: 'rates',      label: t('clientDetail.tabs.rates') },
  ]

  const inputCls = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)]'
  const STATUS_OPTIONS: Client['status'][] = ['lead', 'prospect', 'active', 'paused', 'churned']
  const STATUS_LABELS_MAP: Record<Client['status'], string> = { lead: 'Lead', prospect: 'Prospect', active: 'Active', paused: 'Paused', churned: 'Churned' }

  return (
    <div className="flex flex-col gap-5 h-full">

      {/* ── Edit Modal ── */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setIsEditing(false)}>
          <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] shadow-xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[var(--text)]">{t('clientDetail.editTitle')}</h2>
              <button onClick={() => setIsEditing(false)} className="text-[var(--text-secondary)] hover:text-[var(--text)] text-lg">✕</button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">{t('clientDetail.edit.nameRequired')}</label>
                  <input value={editForm.name ?? ''} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} className={inputCls} placeholder="Company Name"/>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">{t('clientDetail.edit.status')}</label>
                  <select value={editForm.status ?? ''} onChange={e => setEditForm(f => ({...f, status: e.target.value as Client['status']}))} className={inputCls}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS_MAP[s]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">{t('clientDetail.edit.industry')}</label>
                  <input value={editForm.industry ?? ''} onChange={e => setEditForm(f => ({...f, industry: e.target.value}))} className={inputCls} placeholder="IT"/>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">{t('clientDetail.edit.country')}</label>
                  <input value={editForm.country ?? ''} onChange={e => setEditForm(f => ({...f, country: e.target.value}))} className={inputCls} placeholder="Russia"/>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">{t('clientDetail.edit.companySize')}</label>
                  <select value={editForm.company_size ?? ''} onChange={e => setEditForm(f => ({...f, company_size: e.target.value}))} className={inputCls}>
                    <option value="">—</option>
                    {['1-10','11-50','51-200','200+'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">{t('clientDetail.edit.budget')}</label>
                  <select value={editForm.budget_range ?? ''} onChange={e => setEditForm(f => ({...f, budget_range: e.target.value}))} className={inputCls}>
                    <option value="">—</option>
                    {['small','medium','large','enterprise'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">{t('clientDetail.edit.website')}</label>
                  <input value={editForm.website ?? ''} onChange={e => setEditForm(f => ({...f, website: e.target.value}))} className={inputCls} placeholder="https://company.com"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">{t('clientDetail.edit.techStack')}</label>
                  <input value={(editForm.tech_stack ?? []).join(', ')} onChange={e => setEditForm(f => ({...f, tech_stack: e.target.value.split(',').map(s => s.trim()).filter(Boolean)}))} className={inputCls} placeholder="React, Node.js, AWS"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">{t('clientDetail.edit.description')}</label>
                  <textarea rows={3} value={editForm.description ?? ''} onChange={e => setEditForm(f => ({...f, description: e.target.value}))} className={`${inputCls} resize-none`}/>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6 justify-end">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">{t('common.cancel')}</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-medium">
                {savingEdit ? t('common.saving') : t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm min-w-0">
          <Link to="/clients" className="text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors shrink-0">
            {t('clientDetail.breadcrumb')}
          </Link>
          <span className="text-[var(--text-secondary)]">/</span>
          <span className="text-[var(--text)] font-medium truncate">{client.name}</span>
          <StarButton entityType="client" entityId={client.id} size={18} />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--text-secondary)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            {t('common.back')}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 text-sm font-medium text-red-400 border border-red-400/30 rounded-lg hover:bg-red-400/10 transition-colors disabled:opacity-50"
          >
            {deleting ? t('common.deleting') : t('common.delete')}
          </button>
          <button
            onClick={() => setCandidateOpen(true)}
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg-hover)]"
            title="AI: идеальный кандидат"
          >
            🎯 Кандидат
          </button>
          <button
            onClick={() => setTranscriptOpen(true)}
            className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text)] hover:bg-[var(--bg-hover)]"
            title="Транскрипт встречи"
          >
            🎙
          </button>
          <button
            onClick={openEdit}
            className="px-3 py-1.5 text-sm font-medium text-white bg-[var(--accent)] hover:bg-[var(--accent)]/90 rounded-lg transition-colors"
          >
            {t('common.edit')}
          </button>
        </div>
      </div>

      <CandidateMatchModal clientId={client.id} open={candidateOpen} onClose={() => setCandidateOpen(false)} />
      <TranscriptModal clientId={client.id} open={transcriptOpen} onClose={() => setTranscriptOpen(false)} />

      {/* ── Body: Left + Right ── */}
      <div className="flex gap-5 flex-1 min-h-0">
        {/* Left panel — fixed width sidebar */}
        <div className="hidden md:block">
          <LeftPanel client={client} onPatch={patchClient} />
        </div>

        {/* Right panel — tabs + content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Mobile: left panel info shown above tabs */}
          <div className="md:hidden mb-4">
            <LeftPanel client={client} onPatch={patchClient} />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-[var(--border)] mb-5 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap
                  ${activeTab === tab.key
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]'}`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key
                      ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                      : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {activeTab === 'overview'  && <OverviewTab  client={client} deals={deals} tasks={tasks} />}
            {activeTab === 'contacts'  && <ContactsTab  clientId={client.id} contacts={client.contacts} />}
            {activeTab === 'deals'     && <DealsTab     deals={deals} />}
            {activeTab === 'tasks'     && <TasksTab     tasks={tasks} />}
            {activeTab === 'documents' && <DocumentsTab clientId={client.id} />}
            {activeTab === 'notes'     && <NotesTab     clientId={client.id} />}
            {activeTab === 'timeline'  && <ActivityTimeline entity="client" entityId={client.id} />}
            {activeTab === 'rates'     && <RateCardsTab clientId={client.id} />}
            {activeTab === 'overview'  && (
              <div className="mt-4 space-y-4">
                <SyncPanel client={client} onUpdated={setClient} />
                <div className="pt-4 border-t border-[var(--border)]">
                  <CustomFieldsRenderer
                    entity="client"
                    entityId={client.id}
                    values={customFields}
                    onChange={handleCustomFieldChange}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile stat summary (below tabs on small screens) */}
      <div className="md:hidden grid grid-cols-3 gap-2">
        {[
          { label: 'Сделки', value: deals.length },
          { label: 'Открытых', value: openDealsCount },
          { label: 'Задачи', value: tasks.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-[var(--text)]">{value}</div>
            <div className="text-[10px] text-[var(--text-secondary)]">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
