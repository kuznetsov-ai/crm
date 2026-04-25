import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link } from 'react-router-dom'
import type { Deal } from '../../api/deals'
import { useCurrencyStore, formatAmount } from '../../stores/currencyStore'

export default function KanbanCard({ deal }: { deal: Deal }) {
  const currency = useCurrencyStore(s => s.currency)
  const rate = useCurrencyStore(s => s.rate)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`bg-[var(--bg-main)] rounded-[var(--radius-md)] p-3 border cursor-grab active:cursor-grabbing transition-all shadow-sm
        ${isDragging
          ? 'opacity-30 border-[var(--accent)] scale-95'
          : 'border-[var(--border)] hover:border-[var(--accent)]/50 hover:shadow-md'
        }`}
    >
      <Link to={`/deals/${deal.id}`} onClick={(e) => e.stopPropagation()}
        className="font-medium text-sm text-[var(--text)] hover:text-[var(--accent)] block mb-1 line-clamp-2">
        {deal.title}
      </Link>
      {deal.client && <div className="text-xs text-[var(--text-secondary)] mb-2">{deal.client.name}</div>}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--accent)]">
          {formatAmount(deal.value_usd, deal.value_rub, currency, rate)}
        </span>
        <span className="text-xs text-[var(--text-secondary)]">
          {deal.team_size_needed}dev{deal.team_size_needed !== 1 ? 's' : ''}
        </span>
      </div>
      {deal.assigned_to && (
        <div className="mt-1.5 text-xs text-[var(--text-secondary)] truncate">{deal.assigned_to.full_name}</div>
      )}
    </div>
  )
}
