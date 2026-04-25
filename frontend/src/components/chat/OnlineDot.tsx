interface Props {
  online: boolean
  size?: number
  title?: string
}

export default function OnlineDot({ online, size = 8, title }: Props) {
  return (
    <span
      title={title ?? (online ? 'Online' : 'Offline')}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: online ? 'var(--color-green, #5DD39E)' : 'var(--text-secondary, #888)',
        boxShadow: online ? '0 0 0 2px rgba(93, 211, 158, 0.25)' : 'none',
        flexShrink: 0,
      }}
      aria-label={online ? 'online' : 'offline'}
    />
  )
}

export function ReadCheckmarks({ readBy = [], hasMembers = 1, isOwn }: { readBy?: number[]; hasMembers?: number; isOwn: boolean }) {
  if (!isOwn) return null
  // Other members count = total - 1 (the author)
  const others = Math.max(1, hasMembers - 1)
  const readCount = readBy.length
  const readByOthers = readCount > 0
  return (
    <span
      title={readByOthers ? `Read by ${readCount} of ${others}` : 'Sent'}
      className={`inline-flex items-center text-[10px] ml-1 ${readByOthers ? 'opacity-100' : 'opacity-60'}`}
      aria-label={readByOthers ? 'read' : 'sent'}
    >
      {readByOthers ? '✓✓' : '✓'}
    </span>
  )
}

export function lastSeenText(lastSeen: string | null): string {
  if (!lastSeen) return 'never'
  const d = new Date(lastSeen)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} min ago`
  if (diff < 24 * 60 * 60_000) return `${Math.floor(diff / (60 * 60_000))} h ago`
  return d.toLocaleDateString()
}
