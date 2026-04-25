import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core'
import { useTranslation } from 'react-i18next'
import { leadsApi, type Lead } from '../api/leads'
import { pipelinesApi, type Pipeline, type Stage } from '../api/pipelines'
import LeadKanbanColumn from '../components/leads/LeadKanbanColumn'
import LeadKanbanCard from '../components/leads/LeadKanbanCard'
import LostReasonModal from '../components/deals/LostReasonModal'

type Board = Record<number, Lead[]>

export default function LeadsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [pipeline, setPipeline] = useState<Pipeline | null>(null)
  const [allPipelines, setAllPipelines] = useState<Pipeline[]>([])
  const [pipelineOpen, setPipelineOpen] = useState(false)
  const pipelineRef = useRef<HTMLDivElement>(null)

  const [board, setBoard] = useState<Board>({})
  const [boardLoading, setBoardLoading] = useState(true)
  const [draggingLead, setDraggingLead] = useState<Lead | null>(null)
  const savedBoard = useRef<Board>({})
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const [createOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const [lostReasonPending, setLostReasonPending] = useState<{
    leadId: number
    toStageId: number
    boardSnapshot: Board
  } | null>(null)

  // Load lead pipelines
  useEffect(() => {
    pipelinesApi.list('lead').then((ps) => {
      setAllPipelines(ps)
      const def = ps.find(p => p.is_default) ?? ps[0] ?? null
      setPipeline(def)
    })
  }, [])

  // Close pipeline dropdown on outside click
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (pipelineRef.current && !pipelineRef.current.contains(e.target as Node)) {
        setPipelineOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const loadBoard = useCallback(async (pipelineId?: number) => {
    setBoardLoading(true)
    try {
      const groups = await leadsApi.kanban(pipelineId)
      // normalize keys to numbers
      const normalized: Board = {}
      for (const [k, v] of Object.entries(groups)) {
        normalized[Number(k)] = v
      }
      setBoard(normalized)
    } finally {
      setBoardLoading(false)
    }
  }, [])

  useEffect(() => {
    if (pipeline?.id != null) {
      loadBoard(pipeline.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline?.id, loadBoard])

  // All stages from the selected pipeline, in order
  const stages: Stage[] = pipeline?.stages ?? []

  // ── Drag & drop ──────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const id = Number(event.active.id)
    for (const leads of Object.values(board)) {
      const found = leads.find(l => l.id === id)
      if (found) { setDraggingLead(found); break }
    }
    savedBoard.current = JSON.parse(JSON.stringify(board))
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = Number(active.id)
    const overId = over.id

    let fromStageId = 0
    for (const [s, leads] of Object.entries(board)) {
      if (leads.find(l => l.id === activeId)) { fromStageId = Number(s); break }
    }
    if (!fromStageId) return

    // Find target stage
    let toStageId = 0
    if (typeof overId === 'number' && stages.find(s => s.id === overId)) {
      toStageId = overId
    } else {
      for (const [s, leads] of Object.entries(board)) {
        if (leads.find(l => l.id === Number(overId))) { toStageId = Number(s); break }
      }
    }
    // If over is a string that is a stageId
    if (!toStageId && typeof overId === 'string') {
      const num = Number(overId)
      if (!isNaN(num) && stages.find(s => s.id === num)) toStageId = num
    }

    if (!toStageId || fromStageId === toStageId) return

    setBoard(prev => {
      const next = { ...prev }
      const moving = (next[fromStageId] ?? []).find(l => l.id === activeId)
      if (!moving) return prev
      next[fromStageId] = (next[fromStageId] ?? []).filter(l => l.id !== activeId)
      const toCol = [...(next[toStageId] ?? [])]
      const insertAt = toCol.findIndex(l => l.id === Number(overId))
      const updated = { ...moving, stage: toStageId }
      insertAt >= 0 ? toCol.splice(insertAt, 0, updated) : toCol.push(updated)
      next[toStageId] = toCol
      return next
    })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setDraggingLead(null)
    const { active, over } = event
    if (!over) {
      setBoard(savedBoard.current)
      return
    }

    const activeId = Number(active.id)

    // Find current stage from updated board
    let toStageId = 0
    for (const [s, leads] of Object.entries(board)) {
      if (leads.find(l => l.id === activeId)) { toStageId = Number(s); break }
    }
    if (!toStageId) return

    let fromStageId = 0
    for (const [s, leads] of Object.entries(savedBoard.current)) {
      if (leads.find(l => l.id === activeId)) { fromStageId = Number(s); break }
    }

    if (fromStageId === toStageId) return // same column, no API call needed

    const toStage = stages.find(s => s.id === toStageId)

    // Intercept moves to "lost" column — ask for lost_reason first
    if (toStage?.semantic === 'lost') {
      setLostReasonPending({ leadId: activeId, toStageId, boardSnapshot: savedBoard.current })
      return
    }

    // Intercept moves to "converted" column — open convert modal
    if (toStage?.semantic === 'converted') {
      // Just move to stage — lead page will handle the full conversion
      try {
        await leadsApi.update(activeId, { stage: toStageId })
      } catch { loadBoard(pipeline?.id) }
      return
    }

    try {
      await leadsApi.update(activeId, { stage: toStageId })
    } catch { loadBoard(pipeline?.id) }
  }

  async function handleLostReasonSubmit(lostReasonId: number, comment: string) {
    if (!lostReasonPending) return
    const { leadId, toStageId } = lostReasonPending
    setLostReasonPending(null)
    try {
      await leadsApi.update(leadId, {
        stage: toStageId,
        lost_reason: lostReasonId as any,
        lost_comment: comment,
      })
      loadBoard(pipeline?.id)
    } catch { loadBoard(pipeline?.id) }
  }

  function handleLostReasonCancel() {
    if (lostReasonPending) {
      setBoard(lostReasonPending.boardSnapshot)
    }
    setLostReasonPending(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createTitle.trim()) return
    setCreating(true)
    try {
      const lead = await leadsApi.create({ title: createTitle })
      setCreateOpen(false)
      setCreateTitle('')
      navigate(`/leads/${lead.id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4 shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">{t('leads.title')}</h1>
        </div>

        {/* Pipeline switcher */}
        <div ref={pipelineRef} className="relative inline-block">
          {pipeline && (
            <button
              type="button"
              onClick={() => setPipelineOpen(v => !v)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--bg-hover)] text-sm cursor-pointer"
            >
              <span className="text-[var(--text-secondary)]">{t('pipeline.label')}:</span>
              <span className="font-medium">{pipeline.name}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
          {pipelineOpen && allPipelines.length > 1 && (
            <div className="absolute left-0 mt-1 w-56 bg-[var(--bg-card)] border border-[var(--border)] rounded-md shadow-lg z-50">
              {allPipelines.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setPipeline(p); setPipelineOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-hover)] ${p.id === pipeline?.id ? 'font-semibold' : ''}`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="bg-[var(--accent)] text-white text-sm font-medium px-4 py-2 rounded-[var(--radius-md)] hover:opacity-90 transition-opacity"
        >
          + {t('leads.new')}
        </button>
      </div>

      {/* Create Lead inline modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => e.target === e.currentTarget && setCreateOpen(false)}>
          <div role="dialog" className="bg-[var(--bg-card)] rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-semibold text-[var(--text)] mb-4">{t('leads.new')}</h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <input
                type="text"
                autoFocus
                value={createTitle}
                onChange={e => setCreateTitle(e.target.value)}
                placeholder={t('leads.titlePlaceholder')}
                required
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-sm px-3 py-2 outline-none focus:border-[var(--accent)] transition-colors"
              />
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {creating ? t('common.saving') : t('common.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Board */}
      {boardLoading ? (
        <div className="text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>
      ) : (
        <div className="overflow-x-auto pb-4 flex-1 min-h-0">
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
            <div className="flex gap-3 min-w-max h-full">
              {stages.map(stage => (
                <LeadKanbanColumn
                  key={stage.id}
                  stage={stage}
                  leads={board[stage.id] ?? []}
                  draggingId={draggingLead?.id}
                />
              ))}
            </div>
            <DragOverlay dropAnimation={null}>
              {draggingLead ? (
                <div className="bg-[var(--bg-card)] border-2 border-[var(--accent)] rounded-lg p-3 shadow-2xl opacity-95 w-56 rotate-2 cursor-grabbing">
                  <p className="text-sm font-semibold text-[var(--text)] truncate">{draggingLead.title}</p>
                  {draggingLead.company_name && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">{draggingLead.company_name}</p>
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {lostReasonPending && (
        <LostReasonModal onSubmit={handleLostReasonSubmit} onCancel={handleLostReasonCancel} />
      )}
    </div>
  )
}
