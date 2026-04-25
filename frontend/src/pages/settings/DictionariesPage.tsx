import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { DictionaryItem } from '../../api/dictionaries'
import { sourcesApi, lostReasonsApi } from '../../api/dictionaries'

// ── Slug helper ────────────────────────────────────────────
function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

// ── Shared modal for Source / LostReason ───────────────────
interface DictForm {
  name: string
  code: string
}

interface DictModalProps {
  title: string
  item?: DictionaryItem  // undefined = create mode
  onClose: () => void
  onSave: (form: DictForm) => Promise<void>
}

function DictItemModal({ title, item, onClose, onSave }: DictModalProps) {
  const { t } = useTranslation()
  const isEdit = !!item
  const [form, setForm] = useState<DictForm>({
    name: item?.name ?? '',
    code: item?.code ?? '',
  })
  const [codeManual, setCodeManual] = useState(isEdit)
  const [errors, setErrors] = useState<Partial<DictForm>>({})
  const [saving, setSaving] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  function handleNameChange(value: string) {
    setForm(f => ({
      ...f,
      name: value,
      code: codeManual ? f.code : toSlug(value),
    }))
    setErrors(e => ({ ...e, name: undefined }))
  }

  function handleCodeChange(value: string) {
    setCodeManual(true)
    setForm(f => ({ ...f, code: value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') }))
    setErrors(e => ({ ...e, code: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<DictForm> = {}
    if (!form.name.trim()) errs.name = t('dictionaries.nameRequired')
    if (!form.code.trim()) errs.code = t('dictionaries.codeRequired')
    else if (!/^[a-z0-9_-]+$/.test(form.code)) errs.code = t('dictionaries.codePattern')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      await onSave({ name: form.name.trim(), code: form.code })
      onClose()
    } catch {
      setErrors({ name: t('common.error') })
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg-card)] rounded-t-2xl sm:rounded-2xl border border-[var(--border)] shadow-xl w-full sm:max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>
          <button type="button" onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text)] text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
              {t('dictionaries.nameLabel')} *
            </label>
            <input
              ref={nameRef}
              className={`${inputCls} ${errors.name ? 'border-red-400' : ''}`}
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder={t('dictionaries.namePlaceholder')}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
              {t('dictionaries.codeLabel')} * <span className="normal-case font-normal">(slug)</span>
            </label>
            <input
              className={`${inputCls} font-mono ${errors.code ? 'border-red-400' : ''}`}
              value={form.code}
              onChange={e => handleCodeChange(e.target.value)}
              placeholder="my_code"
              disabled={isEdit}
            />
            {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code}</p>}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-medium transition-opacity">
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Section table ──────────────────────────────────────────
interface SectionProps {
  title: string
  newLabel: string
  items: DictionaryItem[]
  onAdd: () => void
  onEdit: (item: DictionaryItem) => void
  onDelete: (item: DictionaryItem) => void
}

function DictSection({ title, newLabel, items, onAdd, onEdit, onDelete }: SectionProps) {
  const { t } = useTranslation()
  return (
    <section>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 className="text-lg font-semibold text-[var(--text)] flex-1 min-w-0">{title}</h2>
        <button onClick={onAdd}
          className="px-3 py-1.5 rounded-md bg-[var(--accent)] text-white text-sm cursor-pointer shrink-0">
          + {newLabel}
        </button>
      </div>

      {/* Mobile: card list */}
      <div className="sm:hidden space-y-2">
        {items.map(item => (
          <div key={item.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-[var(--text)]">{item.name}</div>
                <div className="text-xs text-[var(--text-secondary)] font-mono mt-0.5">{item.code}</div>
              </div>
              <span className="text-xs text-[var(--text-secondary)] shrink-0">{item.is_active ? '✓' : '—'}</span>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => onEdit(item)}
                aria-label={`${t('common.edit')} ${item.name}`}
                className="text-[var(--accent)] text-xs cursor-pointer min-h-[44px] flex-1 flex items-center justify-center border border-[var(--border)] rounded-lg">
                {t('common.edit')}
              </button>
              <button
                onClick={() => onDelete(item)}
                aria-label={`${t('common.delete')} ${item.name}`}
                className="text-red-500 text-xs cursor-pointer min-h-[44px] flex-1 flex items-center justify-center border border-red-200 rounded-lg">
                {t('common.delete')}
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)] py-4 text-center">{t('common.noData')}</p>
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block bg-[var(--bg-card)] border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--text-secondary)] border-b border-[var(--border)]">
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Код</th>
              <th className="px-4 py-2">Название</th>
              <th className="px-4 py-2">Активен</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors">
                <td className="px-4 py-2 text-[var(--text-secondary)]">{item.order}</td>
                <td className="px-4 py-2 font-mono text-xs text-[var(--text)]">{item.code}</td>
                <td className="px-4 py-2 text-[var(--text)]">{item.name}</td>
                <td className="px-4 py-2 text-[var(--text-secondary)]">{item.is_active ? '✓' : '—'}</td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => onEdit(item)}
                      className="text-[var(--accent)] hover:underline text-xs cursor-pointer">
                      {t('common.edit')}
                    </button>
                    <button onClick={() => onDelete(item)}
                      className="text-red-500 hover:underline text-xs cursor-pointer">
                      {t('common.delete')}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Main page ──────────────────────────────────────────────
export default function DictionariesPage() {
  const { t } = useTranslation()
  const [sources, setSources] = useState<DictionaryItem[]>([])
  const [lostReasons, setLostReasons] = useState<DictionaryItem[]>([])
  const [loading, setLoading] = useState(true)

  // Modal state: { section: 'sources'|'lostReasons', item?: DictionaryItem }
  const [modal, setModal] = useState<{ section: 'sources' | 'lostReasons'; item?: DictionaryItem } | null>(null)

  async function load() {
    setLoading(true)
    const [src, lr] = await Promise.all([sourcesApi.list(), lostReasonsApi.list()])
    setSources(src)
    setLostReasons(lr)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Sources ────────────────────────────────────────────────
  async function saveSource({ name, code }: { name: string; code: string }) {
    if (modal?.item) {
      await sourcesApi.update(modal.item.id, { name })
    } else {
      await sourcesApi.create({ code, name, is_active: true, order: sources.length })
    }
    await load()
  }

  async function deleteSource(item: DictionaryItem) {
    if (!window.confirm(t('dictionaries.confirmDelete'))) return
    await sourcesApi.remove(item.id)
    load()
  }

  // ── Lost Reasons ───────────────────────────────────────────
  async function saveLostReason({ name, code }: { name: string; code: string }) {
    if (modal?.item) {
      await lostReasonsApi.update(modal.item.id, { name })
    } else {
      await lostReasonsApi.create({ code, name, is_active: true, order: lostReasons.length })
    }
    await load()
  }

  async function deleteLostReason(item: DictionaryItem) {
    if (!window.confirm(t('dictionaries.confirmDelete'))) return
    await lostReasonsApi.remove(item.id)
    load()
  }

  if (loading) return <div className="p-4 text-[var(--text-secondary)]">{t('common.loading')}</div>

  const isSourceModal = modal?.section === 'sources'
  const modalTitle = modal
    ? (modal.item
        ? (isSourceModal ? t('dictionaries.edit_source') : t('dictionaries.edit_lost_reason'))
        : (isSourceModal ? t('dictionaries.newSource') : t('dictionaries.newLostReason')))
    : ''

  return (
    <div className="p-4 sm:p-6 space-y-8">
      <h1 className="text-2xl font-semibold text-[var(--text)]">{t('dictionaries.title')}</h1>

      <DictSection
        title={t('dictionaries.sources')}
        newLabel={t('dictionaries.newSource')}
        items={sources}
        onAdd={() => setModal({ section: 'sources' })}
        onEdit={item => setModal({ section: 'sources', item })}
        onDelete={deleteSource}
      />

      <DictSection
        title={t('dictionaries.lostReasons')}
        newLabel={t('dictionaries.newLostReason')}
        items={lostReasons}
        onAdd={() => setModal({ section: 'lostReasons' })}
        onEdit={item => setModal({ section: 'lostReasons', item })}
        onDelete={deleteLostReason}
      />

      {modal && (
        <DictItemModal
          title={modalTitle}
          item={modal.item}
          onClose={() => setModal(null)}
          onSave={isSourceModal ? saveSource : saveLostReason}
        />
      )}
    </div>
  )
}
