import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import KanbanCard from './KanbanCard'
import type { Deal } from '../../api/deals'

export default function KanbanColumn({ status, label, deals }: { status: string; label: string; deals: Deal[]; draggingId?: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div className="flex-shrink-0 w-60 flex flex-col" style={{ minHeight: 'calc(100vh - 200px)' }}>
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-xs font-semibold text-[var(--text)] uppercase tracking-wide">{label}</h3>
        <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">{deals.length}</span>
      </div>
      <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex-1 space-y-2 rounded-lg p-2 transition-all
            ${isOver
              ? 'bg-[var(--accent)]/10 border-2 border-dashed border-[var(--accent)]/50'
              : 'bg-[var(--bg-hover)]/40 border-2 border-transparent'
            }`}
        >
          {deals.map((deal) => <KanbanCard key={deal.id} deal={deal} />)}
          {deals.length === 0 && (
            <div className={`h-16 rounded-lg flex items-center justify-center text-xs transition-colors ${
              isOver ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]'
            }`}>
              {isOver ? 'Отпусти здесь' : 'Нет сделок'}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  )
}
