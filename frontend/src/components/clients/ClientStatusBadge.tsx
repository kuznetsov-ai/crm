import { Badge } from 'idev-ui'

const STATUS_CONFIG = {
  lead: { color: 'blue' as const, label: 'Лид' },
  prospect: { color: 'yellow' as const, label: 'Потенциальный' },
  active: { color: 'green' as const, label: 'Активный' },
  paused: { color: 'gray' as const, label: 'На паузе' },
  churned: { color: 'red' as const, label: 'Потерян' },
} as const

export default function ClientStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG]
  if (!config) return <span>{status}</span>
  return <Badge color={config.color}>{config.label}</Badge>
}
