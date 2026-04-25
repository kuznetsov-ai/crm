import type { RiskLevel } from '../../api/clients'

const STYLES: Record<RiskLevel, { bg: string; text: string; label: string; emoji: string }> = {
  low:      { bg: 'bg-green-500/15',  text: 'text-green-500',  label: 'Низкий',    emoji: '✓' },
  medium:   { bg: 'bg-yellow-500/15', text: 'text-yellow-500', label: 'Средний',   emoji: '⚠' },
  high:     { bg: 'bg-orange-500/15', text: 'text-orange-500', label: 'Высокий',   emoji: '⚠' },
  critical: { bg: 'bg-red-500/15',    text: 'text-red-500',    label: 'Критический', emoji: '🔥' },
}

export default function RiskBadge({ level, score, className = '' }: { level: RiskLevel; score?: number; className?: string }) {
  const s = STYLES[level] ?? STYLES.low
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${s.bg} ${s.text} ${className}`} title={`Risk ${score ?? '—'}`}>
      <span>{s.emoji}</span>
      {s.label}{score !== undefined ? ` · ${score}` : ''}
    </span>
  )
}
