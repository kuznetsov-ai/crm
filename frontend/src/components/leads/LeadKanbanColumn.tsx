import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import LeadKanbanCard from './LeadKanbanCard'
import type { Lead } from '../../api/leads'
import type { Stage } from '../../api/pipelines'

interface Props {
  stage: Stage
  leads: Lead[]
  draggingId?: number
}

export default function LeadKanbanColumn({ stage, leads, draggingId: _draggingId }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const isConverted = stage.semantic === 'converted'
  const isLost = stage.semantic === 'lost'

  return (
    <div className="flex-shrink-0 w-60 flex flex-col" style={{ minHeight: 'calc(100vh - 200px)' }}>
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="text-xs font-semibold text-[var(--text)] uppercase tracking-wide">
            {stage.name}
          </h3>
          {isConverted && (
            <span className="text-[10px] text-emerald-600 font-medium">✓</span>
          )}
          {isLost && (
            <span className="text-[10px] text-red-500 font-medium">✕</span>
          )}
        </div>
        <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>
      <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex-1 space-y-2 rounded-lg p-2 transition-all
            ${isOver
              ? 'bg-[var(--accent)]/10 border-2 border-dashed border-[var(--accent)]/50'
              : 'bg-[var(--bg-hover)]/40 border-2 border-transparent'
            }`}
        >
          {leads.map((lead) => (
            <LeadKanbanCard key={lead.id} lead={lead} />
          ))}
          {leads.length === 0 && (
            <div className={`h-16 rounded-lg flex items-center justify-center text-xs transition-colors ${
              isOver ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
            }`}>
              {isOver ? 'Отпусти здесь' : 'Нет лидов'}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}
