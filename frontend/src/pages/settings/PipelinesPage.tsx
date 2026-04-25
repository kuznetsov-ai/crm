import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Pipeline, Stage } from '../../api/pipelines'
import { pipelinesApi, stagesApi } from '../../api/pipelines'
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

// ── Slug helper ────────────────────────────────────────────
function toSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

// ── Grip icon ──────────────────────────────────────────────
function GripIcon() {
  return (
    <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="2" r="1.5"/><circle cx="7" cy="2" r="1.5"/>
      <circle cx="3" cy="7" r="1.5"/><circle cx="7" cy="7" r="1.5"/>
      <circle cx="3" cy="12" r="1.5"/><circle cx="7" cy="12" r="1.5"/>
    </svg>
  )
}

// ── Pipeline create modal ──────────────────────────────────
interface PipelineModalProps {
  onClose: () => void
  onSave: () => void
}

function PipelineModal({ onClose, onSave }: PipelineModalProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { nameRef.current?.focus() }, [])

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError(t('pipelines.nameRequired')); return }
    setSaving(true)
    try {
      await pipelinesApi.create({ kind: 'deal', name: trimmed })
      onSave()
      onClose()
    } catch {
      setError(t('common.error'))
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
          <h2 className="text-base font-semibold text-[var(--text)]">{t('pipelines.new_pipeline')}</h2>
          <button type="button" onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text)] text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
              {t('pipelines.name')} *
            </label>
            <input
              ref={nameRef}
              className={inputCls}
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              placeholder={t('pipelines.namePlaceholder')}
            />
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 font-medium transition-opacity">
              {saving ? t('common.saving') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Stage create/edit modal ────────────────────────────────
interface StageForm {
  name: string
  code: string
  semantic: Stage['semantic']
  color: string
}

const STAGE_SEMANTICS: { value: Stage['semantic']; label: string }[] = [
  { value: 'open',      label: 'Открыто' },
  { value: 'won',       label: 'Выиграно' },
  { value: 'lost',      label: 'Проиграно' },
  { value: 'converted', label: 'Конвертировано' },
]

interface StageModalProps {
  pipeline: Pipeline
  stage?: Stage
  onClose: () => void
  onSave: () => void
}

function StageModal({ pipeline, stage, onClose, onSave }: StageModalProps) {
  const { t } = useTranslation()
  const isEdit = !!stage
  const [form, setForm] = useState<StageForm>({
    name:     stage?.name     ?? '',
    code:     stage?.code     ?? '',
    semantic: stage?.semantic ?? 'open',
    color:    stage?.color    ?? '#6B7280',
  })
  const [codeManual, setCodeManual] = useState(isEdit)
  const [errors, setErrors] = useState<Partial<StageForm>>({})
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
    setErrors(e => ({ ...e, name: undefined, code: undefined }))
  }

  function handleCodeChange(value: string) {
    setCodeManual(true)
    setForm(f => ({ ...f, code: value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') }))
    setErrors(e => ({ ...e, code: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<StageForm> = {}
    if (!form.name.trim()) errs.name = t('pipelines.nameRequired')
    if (!form.code.trim()) errs.code = t('pipelines.codeRequired')
    else if (!/^[a-z0-9_-]+$/.test(form.code)) errs.code = t('pipelines.codePattern')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      if (isEdit) {
        await stagesApi.update(stage!.id, { name: form.name, code: form.code, semantic: form.semantic, color: form.color })
      } else {
        await stagesApi.create({
          pipeline: pipeline.id,
          name:     form.name,
          code:     form.code,
          semantic: form.semantic,
          color:    form.color,
          order:    pipeline.stages.length,
        })
      }
      onSave()
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
          <h2 className="text-base font-semibold text-[var(--text)]">
            {isEdit ? t('pipelines.edit_stage') : t('pipelines.add_stage_title')}
          </h2>
          <button type="button" onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--text)] text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
              {t('pipelines.name')} *
            </label>
            <input
              ref={nameRef}
              className={`${inputCls} ${errors.name ? 'border-red-400' : ''}`}
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder={t('pipelines.stageNamePlaceholder')}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
              {t('pipelines.code')} * <span className="normal-case font-normal">(slug)</span>
            </label>
            <input
              className={`${inputCls} font-mono ${errors.code ? 'border-red-400' : ''}`}
              value={form.code}
              onChange={e => handleCodeChange(e.target.value)}
              placeholder="my_stage"
              disabled={isEdit}
            />
            {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
              {t('pipelines.semantic')}
            </label>
            <select
              className={inputCls}
              value={form.semantic}
              onChange={e => setForm(f => ({ ...f, semantic: e.target.value as Stage['semantic'] }))}
            >
              {STAGE_SEMANTICS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide mb-1">
              {t('pipelines.color')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="h-9 w-12 rounded border border-[var(--border)] cursor-pointer p-0.5"
              />
              <input
                className={`${inputCls} font-mono flex-1`}
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                placeholder="#6B7280"
              />
            </div>
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

// ── Sortable stage row ─────────────────────────────────────
interface SortableStageRowProps {
  stage: Stage
  pipeline: Pipeline
  isDragging: boolean
  onEdit: () => void
  onDelete: () => void
}

function SortableStageRow({ stage, isDragging, onEdit, onDelete }: SortableStageRowProps) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isSelfDragging } = useSortable({ id: stage.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-t border-[var(--border)] transition-opacity ${isSelfDragging ? 'opacity-30' : ''} ${isDragging && !isSelfDragging ? '' : ''}`}
    >
      {/* Grip handle */}
      <td className="py-1 pr-1 w-7">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center w-7 h-7 cursor-grab active:cursor-grabbing text-[var(--border)] hover:text-[var(--text-secondary)] transition-colors select-none"
          title="Drag to reorder"
        >
          <GripIcon />
        </div>
      </td>
      <td className="py-1 pr-2">{stage.order}</td>
      <td className="py-1 pr-2">{stage.name}</td>
      <td className="py-1 pr-2 font-mono text-xs">{stage.code}</td>
      <td className="py-1 pr-2">{stage.semantic}</td>
      <td className="py-1 pr-2">
        <span className="inline-block w-4 h-4 rounded align-middle" style={{ background: stage.color }} />
        <span className="text-xs ml-1">{stage.color}</span>
      </td>
      <td className="text-right">
        <div className="flex items-center justify-end gap-2">
          <button onClick={onEdit} className="text-[var(--accent)] hover:underline text-xs cursor-pointer">
            {t('common.edit')}
          </button>
          <button onClick={onDelete} className="text-red-500 hover:underline text-xs cursor-pointer">
            {t('common.delete')}
          </button>
        </div>
      </td>
    </tr>
  )
}

// ── Pipeline card with sortable stages ────────────────────
interface PipelineCardProps {
  pipeline: Pipeline
  onStagesChange: (pipelineId: number, newStages: Stage[]) => void
  onAddStage: () => void
  onEditStage: (stage: Stage) => void
  onDeleteStage: (stage: Stage) => void
  onDeletePipeline: () => void
}

function PipelineCard({ pipeline, onStagesChange, onAddStage, onEditStage, onDeleteStage, onDeletePipeline }: PipelineCardProps) {
  const { t } = useTranslation()
  const [draggingStage, setDraggingStage] = useState<Stage | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  function handleDragStart(e: DragStartEvent) {
    const found = pipeline.stages.find(s => s.id === Number(e.active.id))
    if (found) setDraggingStage(found)
  }

  async function handleDragEnd(e: DragEndEvent) {
    setDraggingStage(null)
    const { active, over } = e
    if (!over || active.id === over.id) return

    const oi = pipeline.stages.findIndex(s => s.id === Number(active.id))
    const ni = pipeline.stages.findIndex(s => s.id === Number(over.id))
    if (oi === -1 || ni === -1) return

    const newStages = arrayMove(pipeline.stages, oi, ni)
    // Optimistic update
    onStagesChange(pipeline.id, newStages)
    // Persist: PATCH each stage with its new order index
    await Promise.all(newStages.map((s, idx) => stagesApi.update(s.id, { order: idx })))
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <h2 className="font-semibold">{pipeline.name}</h2>
        {pipeline.is_default && (
          <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-secondary)]">default</span>
        )}
        <div className="flex-1" />
        <button onClick={onAddStage}
          className="text-sm px-2 py-1 rounded hover:bg-[var(--bg-hover)] cursor-pointer shrink-0">
          + {t('pipelines.add_stage')}
        </button>
        <button onClick={onDeletePipeline}
          disabled={pipeline.is_default}
          className="text-sm px-2 py-1 rounded text-red-500 hover:bg-[var(--bg-hover)] cursor-pointer disabled:opacity-40 shrink-0">×</button>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-2">
        {pipeline.stages.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)] py-3 text-center">{t('common.noData')}</p>
        )}
        {pipeline.stages.map(s => (
          <div key={s.id} className="border border-[var(--border)] rounded-lg p-3 text-sm space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-[var(--text)]">{s.name}</span>
              <div className="flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded" style={{ background: s.color }} />
                <span className="text-xs text-[var(--text-secondary)]">{s.color}</span>
              </div>
            </div>
            <div className="text-xs text-[var(--text-secondary)] font-mono">{s.code}</div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs text-[var(--text-secondary)]">{s.semantic} · #{s.order}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => onEditStage(s)}
                  aria-label={`${t('common.edit')} ${s.name}`}
                  className="text-[var(--accent)] text-xs cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center border border-[var(--border)] rounded-lg px-2">
                  {t('common.edit')}
                </button>
                <button
                  onClick={() => onDeleteStage(s)}
                  aria-label={`${t('common.delete')} ${s.name}`}
                  className="text-red-500 text-xs cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center border border-red-200 rounded-lg px-2">
                  {t('common.delete')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table with drag */}
      <div className="hidden sm:block overflow-x-auto">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={pipeline.stages.map(s => s.id)} strategy={verticalListSortingStrategy}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--text-secondary)]">
                  <th className="py-1 w-7"></th>
                  <th className="py-1 pr-2">#</th>
                  <th className="py-1 pr-2">Name</th>
                  <th className="py-1 pr-2">Code</th>
                  <th className="py-1 pr-2">Semantic</th>
                  <th className="py-1 pr-2">Color</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pipeline.stages.map(s => (
                  <SortableStageRow
                    key={s.id}
                    stage={s}
                    pipeline={pipeline}
                    isDragging={!!draggingStage}
                    onEdit={() => onEditStage(s)}
                    onDelete={() => onDeleteStage(s)}
                  />
                ))}
              </tbody>
            </table>
          </SortableContext>
          <DragOverlay dropAnimation={null}>
            {draggingStage ? (
              <div className="bg-[var(--bg-card)] border-2 border-[var(--accent)] rounded-lg px-4 py-2 shadow-2xl opacity-95 text-sm font-medium cursor-grabbing">
                {draggingStage.name}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────
export default function PipelinesPage() {
  const { t } = useTranslation()
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [loading, setLoading] = useState(true)
  const [showPipelineModal, setShowPipelineModal] = useState(false)
  const [stageModal, setStageModal] = useState<{ pipeline: Pipeline; stage?: Stage } | null>(null)

  async function load() {
    setLoading(true)
    setPipelines(await pipelinesApi.list('deal'))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function handleStagesChange(pipelineId: number, newStages: Stage[]) {
    setPipelines(prev => prev.map(p => p.id === pipelineId ? { ...p, stages: newStages } : p))
  }

  async function delStage(s: Stage) {
    if (!window.confirm('Delete stage?')) return
    await stagesApi.remove(s.id)
    load()
  }

  async function delPipeline(p: Pipeline) {
    if (p.is_default) { alert('Cannot delete default pipeline'); return }
    if (!window.confirm(`Delete pipeline "${p.name}"?`)) return
    await pipelinesApi.remove(p.id)
    load()
  }

  if (loading) return <div className="p-4 text-[var(--text-secondary)]">{t('common.loading')}</div>

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4">
        <h1 className="text-2xl font-semibold flex-1 min-w-0">{t('pipelines.title')}</h1>
        <button onClick={() => setShowPipelineModal(true)}
          className="px-3 py-1.5 rounded-md bg-[var(--accent)] text-white text-sm cursor-pointer shrink-0">
          + {t('pipelines.new_pipeline')}
        </button>
      </div>

      <div className="space-y-4">
        {pipelines.map(p => (
          <PipelineCard
            key={p.id}
            pipeline={p}
            onStagesChange={handleStagesChange}
            onAddStage={() => setStageModal({ pipeline: p })}
            onEditStage={stage => setStageModal({ pipeline: p, stage })}
            onDeleteStage={delStage}
            onDeletePipeline={() => delPipeline(p)}
          />
        ))}
      </div>

      {/* Pipeline create modal */}
      {showPipelineModal && (
        <PipelineModal onClose={() => setShowPipelineModal(false)} onSave={load} />
      )}

      {/* Stage create/edit modal */}
      {stageModal && (
        <StageModal
          pipeline={stageModal.pipeline}
          stage={stageModal.stage}
          onClose={() => setStageModal(null)}
          onSave={load}
        />
      )}
    </div>
  )
}
