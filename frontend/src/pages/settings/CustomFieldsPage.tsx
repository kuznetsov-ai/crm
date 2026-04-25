import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { CustomFieldDef, EntityType, FieldType, FieldOption } from '../../api/customFields'
import { customFieldsApi } from '../../api/customFields'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const ENTITY_TABS: { key: EntityType; label: string }[] = [
  { key: 'client', label: 'Клиенты' },
  { key: 'deal',   label: 'Сделки' },
  { key: 'lead',   label: 'Лиды' },
]

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'string',     label: 'Строка' },
  { value: 'text',       label: 'Текст' },
  { value: 'number',     label: 'Число' },
  { value: 'date',       label: 'Дата' },
  { value: 'datetime',   label: 'Дата и время' },
  { value: 'boolean',    label: 'Да/Нет' },
  { value: 'enum',       label: 'Список' },
  { value: 'multi_enum', label: 'Мультисписок' },
  { value: 'url',        label: 'URL' },
  { value: 'email',      label: 'Email' },
]

interface FieldForm {
  label: string
  code: string
  type: FieldType
  required: boolean
  help_text: string
  optionsRaw: string  // "code,label" per line for enum types
}

const EMPTY_FORM: FieldForm = {
  label: '',
  code: '',
  type: 'string',
  required: false,
  help_text: '',
  optionsRaw: '',
}

function parseOptions(raw: string): FieldOption[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(',')
      if (idx === -1) return { code: line, label: line }
      return { code: line.slice(0, idx).trim(), label: line.slice(idx + 1).trim() }
    })
}

function serializeOptions(opts: FieldOption[]): string {
  return opts.map((o) => `${o.code},${o.label}`).join('\n')
}

function isEnumType(type: FieldType): boolean {
  return type === 'enum' || type === 'multi_enum'
}

// ── Modal wrapper with Esc + click-outside ────────────────
function EscModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-card)] rounded-t-2xl sm:rounded-xl border border-[var(--border)] shadow-xl w-full sm:max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  )
}

// ── Grip icon ─────────────────────────────────────────────
function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/>
      <circle cx="3" cy="7" r="1.5"/><circle cx="7" cy="7" r="1.5"/>
      <circle cx="3" cy="12" r="1.5"/><circle cx="7" cy="12" r="1.5"/>
    </svg>
  )
}

// ── Sortable field row ─────────────────────────────────────
interface SortableFieldRowProps {
  def: CustomFieldDef
  onEdit: () => void
  onDelete: () => void
}

function SortableFieldRow({ def, onEdit, onDelete }: SortableFieldRowProps) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: def.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-t border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors ${isDragging ? 'opacity-30' : ''}`}
    >
      <td className="px-2 py-3 w-7">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center w-7 h-7 cursor-grab active:cursor-grabbing text-[var(--border)] hover:text-[var(--text-secondary)] transition-colors select-none"
          title="Drag to reorder"
        >
          <GripIcon />
        </div>
      </td>
      <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">{def.order}</td>
      <td className="px-4 py-3 font-mono text-xs text-[var(--text)]">{def.code}</td>
      <td className="px-4 py-3 text-[var(--text)] font-medium">
        {def.label}
        {def.help_text && (
          <p className="text-[10px] text-[var(--text-secondary)] font-normal mt-0.5">{def.help_text}</p>
        )}
      </td>
      <td className="px-4 py-3 text-[var(--text-secondary)]">
        {FIELD_TYPES.find((ft) => ft.value === def.type)?.label ?? def.type}
      </td>
      <td className="px-4 py-3 text-center text-[var(--text-secondary)]">
        {def.required ? '✓' : '—'}
      </td>
      <td className="px-4 py-3 text-center text-[var(--text-secondary)]">
        {def.is_active ? '✓' : '—'}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button onClick={onEdit} className="text-[var(--accent)] hover:underline text-xs px-2 py-1">
            {t('common.edit')}
          </button>
          <button onClick={onDelete} className="text-red-500 hover:underline text-xs px-2 py-1">
            {t('common.delete')}
          </button>
        </div>
      </td>
    </tr>
  )
}

export default function CustomFieldsPage() {
  const { t } = useTranslation()
  const [activeEntity, setActiveEntity] = useState<EntityType>('deal')
  const [defs, setDefs] = useState<CustomFieldDef[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FieldForm>(EMPTY_FORM)
  const [codeManual, setCodeManual] = useState(false)
  const [formErrors, setFormErrors] = useState<{ label?: string; code?: string }>({})
  const [saving, setSaving] = useState(false)
  const [draggingDef, setDraggingDef] = useState<CustomFieldDef | null>(null)
  const labelRef = useRef<HTMLInputElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  async function reload() {
    setLoading(true)
    try {
      const data = await customFieldsApi.listDefs(activeEntity)
      setDefs(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { reload() }, [activeEntity])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setCodeManual(false)
    setFormErrors({})
    setShowForm(true)
    setTimeout(() => labelRef.current?.focus(), 50)
  }

  function openEdit(def: CustomFieldDef) {
    setEditingId(def.id)
    setForm({
      label: def.label,
      code: def.code,
      type: def.type,
      required: def.required,
      help_text: def.help_text,
      optionsRaw: serializeOptions(def.options ?? []),
    })
    setCodeManual(true)
    setFormErrors({})
    setShowForm(true)
    setTimeout(() => labelRef.current?.focus(), 50)
  }

  function handleLabelChange(value: string) {
    setForm(f => ({
      ...f,
      label: value,
      code: codeManual ? f.code : value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''),
    }))
    setFormErrors(e => ({ ...e, label: undefined }))
  }

  function handleCodeChange(value: string) {
    setCodeManual(true)
    setForm(f => ({ ...f, code: value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))
    setFormErrors(e => ({ ...e, code: undefined }))
  }

  async function handleSave() {
    const errs: { label?: string; code?: string } = {}
    if (!form.label.trim()) errs.label = 'Заполните Название'
    if (!form.code.trim()) errs.code = 'Заполните Код'
    else if (!/^[a-z0-9_]+$/.test(form.code)) errs.code = 'Только a-z, 0-9, _'
    if (Object.keys(errs).length > 0) { setFormErrors(errs); return }
    setSaving(true)
    try {
      const payload = {
        entity: activeEntity,
        label: form.label,
        code: form.code,
        type: form.type,
        required: form.required,
        help_text: form.help_text,
        options: isEnumType(form.type) ? parseOptions(form.optionsRaw) : [],
        is_active: true,
        order: editingId ? (defs.find((d) => d.id === editingId)?.order ?? 0) : defs.length,
      }
      if (editingId) {
        await customFieldsApi.updateDef(editingId, payload)
      } else {
        await customFieldsApi.createDef(payload)
      }
      setShowForm(false)
      reload()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(def: CustomFieldDef) {
    if (!window.confirm(`Удалить поле "${def.label}"? Все значения будут потеряны.`)) return
    await customFieldsApi.deleteDef(def.id)
    reload()
  }

  async function handleMoveUp(idx: number) {
    if (idx === 0) return
    const newOrder = defs.map((d) => d.id)
    ;[newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]]
    await customFieldsApi.reorder({ entity: activeEntity, ids: newOrder })
    reload()
  }

  async function handleMoveDown(idx: number) {
    if (idx >= defs.length - 1) return
    const newOrder = defs.map((d) => d.id)
    ;[newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]
    await customFieldsApi.reorder({ entity: activeEntity, ids: newOrder })
    reload()
  }

  function handleDragStart(e: DragStartEvent) {
    const found = defs.find(d => d.id === Number(e.active.id))
    if (found) setDraggingDef(found)
  }

  async function handleDragEnd(e: DragEndEvent) {
    setDraggingDef(null)
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oi = defs.findIndex(d => d.id === Number(active.id))
    const ni = defs.findIndex(d => d.id === Number(over.id))
    if (oi === -1 || ni === -1) return
    const newDefs = arrayMove(defs, oi, ni)
    setDefs(newDefs)  // optimistic update
    await customFieldsApi.reorder({ entity: activeEntity, ids: newDefs.map(d => d.id) })
  }

  const inputCls =
    'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-semibold text-[var(--text)]">
          {t('customFields.pageTitle', 'Кастомные поля')}
        </h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + {t('customFields.newField', 'Новое поле')}
        </button>
      </div>

      {/* Entity tabs */}
      <div className="flex border-b border-[var(--border)]">
        {ENTITY_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveEntity(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeEntity === tab.key
                ? 'border-[var(--accent)] text-[var(--text)]'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Definitions table */}
      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">{t('common.loading')}</p>
      ) : defs.length === 0 ? (
        <div className="text-center py-10 text-[var(--text-secondary)]">
          <p className="text-sm">Нет кастомных полей для этой сущности.</p>
          <button
            onClick={openCreate}
            className="mt-3 text-[var(--accent)] text-sm hover:underline"
          >
            + Добавить первое поле
          </button>
        </div>
      ) : (
        <>
          {/* Mobile: card list */}
          <div className="sm:hidden space-y-2">
            {defs.map(def => (
              <div key={def.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[var(--text)]">{def.label}</div>
                    <div className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">{def.code}</div>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                      {FIELD_TYPES.find(ft => ft.value === def.type)?.label ?? def.type}
                      {def.required ? ' · обязательное' : ''}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => openEdit(def)}
                    aria-label={`${t('common.edit')} ${def.label}`}
                    className="text-[var(--accent)] text-xs cursor-pointer min-h-[44px] flex-1 flex items-center justify-center border border-[var(--border)] rounded-lg">
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(def)}
                    aria-label={`${t('common.delete')} ${def.label}`}
                    className="text-red-500 text-xs cursor-pointer min-h-[44px] flex-1 flex items-center justify-center border border-red-200 rounded-lg">
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: sortable table */}
          <div className="hidden sm:block bg-[var(--bg-card)] border border-[var(--border)] rounded-xl overflow-x-auto">
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <SortableContext items={defs.map(d => d.id)} strategy={verticalListSortingStrategy}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)] bg-[var(--bg-hover)]">
                      <th className="px-2 py-3 w-7"></th>
                      <th className="px-4 py-3 w-8">#</th>
                      <th className="px-4 py-3">Код</th>
                      <th className="px-4 py-3">Название</th>
                      <th className="px-4 py-3">Тип</th>
                      <th className="px-4 py-3 text-center">Обяз.</th>
                      <th className="px-4 py-3 text-center">Активно</th>
                      <th className="px-4 py-3 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defs.map((def) => (
                      <SortableFieldRow
                        key={def.id}
                        def={def}
                        onEdit={() => openEdit(def)}
                        onDelete={() => handleDelete(def)}
                      />
                    ))}
                  </tbody>
                </table>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {draggingDef ? (
                  <div className="bg-[var(--bg-card)] border-2 border-[var(--accent)] rounded-lg px-4 py-2 shadow-2xl opacity-95 text-sm font-medium cursor-grabbing">
                    {draggingDef.label}
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <EscModal onClose={() => setShowForm(false)}>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--text)]">
              {editingId ? 'Редактировать поле' : 'Новое поле'}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-[var(--text-secondary)] hover:text-[var(--text)] text-lg leading-none"
            >
              ✕
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
              Название *
            </label>
            <input
              ref={labelRef}
              className={`${inputCls} ${formErrors.label ? 'border-red-400' : ''}`}
              value={form.label}
              onChange={(e) => handleLabelChange(e.target.value)}
              placeholder="ИНН Председателя"
            />
            {formErrors.label && <p className="text-xs text-red-500 mt-1">{formErrors.label}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
              Код * (slug, латиница, underscore)
            </label>
            <input
              className={`${inputCls} font-mono ${formErrors.code ? 'border-red-400' : ''}`}
              value={form.code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="inn_chairman"
              disabled={!!editingId}
            />
            {formErrors.code && <p className="text-xs text-red-500 mt-1">{formErrors.code}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
              Тип поля
            </label>
            <select
              className={inputCls}
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as FieldType }))}
            >
              {FIELD_TYPES.map((ft) => (
                <option key={ft.value} value={ft.value}>
                  {ft.label}
                </option>
              ))}
            </select>
          </div>

          {isEnumType(form.type) && (
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
                Варианты (код,название — по одному на строку)
              </label>
              <textarea
                className={`${inputCls} resize-y`}
                rows={4}
                value={form.optionsRaw}
                onChange={(e) => setForm((f) => ({ ...f, optionsRaw: e.target.value }))}
                placeholder={'high,Высокий\nmedium,Средний\nlow,Низкий'}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
              Подсказка (help text)
            </label>
            <input
              className={inputCls}
              value={form.help_text}
              onChange={(e) => setForm((f) => ({ ...f, help_text: e.target.value }))}
              placeholder="Необязательная подсказка для пользователя"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.required}
              onChange={(e) => setForm((f) => ({ ...f, required: e.target.checked }))}
              className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
            />
            <span className="text-sm text-[var(--text)]">Обязательное поле</span>
          </label>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-medium"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </EscModal>
      )}
    </div>
  )
}
