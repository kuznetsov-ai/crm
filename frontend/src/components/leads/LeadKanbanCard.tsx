import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link } from 'react-router-dom'
import type { Lead } from '../../api/leads'
import { useCurrencyStore } from '../../stores/currencyStore'

export default function LeadKanbanCard({ lead }: { lead: Lead }) {
  const currency = useCurrencyStore(s => s.currency)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
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
      <Link
        to={`/leads/${lead.id}`}
        onClick={(e) => e.stopPropagation()}
        className="font-medium text-sm text-[var(--text)] hover:text-[var(--accent)] block mb-1 line-clamp-2"
      >
        {lead.title}
      </Link>
      {lead.company_name && (
        <div className="text-xs text-[var(--text-secondary)] mb-1">{lead.company_name}</div>
      )}
      {(lead.first_name || lead.last_name) && (
        <div className="text-xs text-[var(--text-secondary)] mb-2">
          {[lead.first_name, lead.last_name].filter(Boolean).join(' ')}
        </div>
      )}
      <div className="flex items-center justify-between mt-1">
        {lead.opportunity ? (
          <span className="text-xs font-medium text-[var(--accent)]">
            {currency === 'RUB' ? '₽' : '$'} {Number(lead.opportunity).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}
          </span>
        ) : (
          <span className="text-xs text-[var(--text-secondary)]">—</span>
        )}
        {lead.email && (
          <span className="text-xs text-[var(--text-secondary)] truncate max-w-[100px]">{lead.email}</span>
        )}
      </div>
      {lead.converted_at && (
        <div className="mt-1.5 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 inline-block">
          Конвертирован
        </div>
      )}
    </div>
  )
}
