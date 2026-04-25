import { useEffect, useState } from 'react'
import { chatApi, type ChatMessage } from '../../api/chat'

interface Props {
  channelId: number
  open: boolean
  onClose: () => void
}

const KINDS = ['image', 'audio', 'file'] as const

export default function MediaGalleryModal({ channelId, open, onClose }: Props) {
  const [kind, setKind] = useState<typeof KINDS[number]>('image')
  const [items, setItems] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    chatApi.messages.media(channelId, kind).then(d => setItems(d.results)).finally(() => setLoading(false))
  }, [open, channelId, kind])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-card-solid,var(--bg-card))] rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-[var(--border)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <div className="font-mono text-xs text-[var(--accent)] uppercase tracking-wider">// media gallery</div>
            <h3 className="font-semibold text-[var(--text)]">Channel attachments</h3>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--danger)]">✕</button>
        </div>

        <div className="flex border-b border-[var(--border)]">
          {KINDS.map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`px-4 py-2.5 text-xs font-mono uppercase tracking-wider transition-colors ${
                kind === k
                  ? 'text-[var(--accent)] border-b-2 border-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)]'
              }`}
            >
              {k}s
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          {loading ? (
            <div className="text-[var(--text-secondary)] text-sm font-mono">loading…</div>
          ) : items.length === 0 ? (
            <div className="text-[var(--text-secondary)] text-sm font-mono">no {kind}s in this channel</div>
          ) : kind === 'image' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {items.map(m => m.attachment_url && (
                <a
                  key={m.id}
                  href={m.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block bg-[var(--bg-hover)] rounded-lg overflow-hidden aspect-square"
                  title={`${m.author?.full_name ?? ''} · ${new Date(m.created_at).toLocaleString()}`}
                >
                  <img src={m.attachment_url} alt={m.attachment_name} className="w-full h-full object-cover" loading="lazy" />
                </a>
              ))}
            </div>
          ) : (
            <ul className="space-y-1">
              {items.map(m => (
                <li key={m.id} className="px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <a
                      href={m.attachment_url ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[var(--accent)] hover:underline truncate block"
                    >
                      {kind === 'audio' ? '🎤' : '📄'} {m.attachment_name || 'attachment'}
                    </a>
                    <div className="text-xs text-[var(--text-secondary)] font-mono truncate">
                      {m.author?.full_name ?? '—'} · {new Date(m.created_at).toLocaleString()} · {(m.attachment_size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
