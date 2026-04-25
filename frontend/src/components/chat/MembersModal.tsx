import { useEffect, useState } from 'react'
import { chatApi, type ChatChannel, type ChatUser, type PresenceMember } from '../../api/chat'
import OnlineDot, { lastSeenText } from './OnlineDot'

interface Props {
  channel: ChatChannel
  open: boolean
  onClose: () => void
  onChanged: () => void
}

interface UserSearchResult {
  id: number
  email: string
  first_name?: string
  last_name?: string
  full_name?: string
}

export default function MembersModal({ channel, open, onClose, onChanged }: Props) {
  const [presence, setPresence] = useState<PresenceMember[]>([])
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<UserSearchResult[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    chatApi.presence.list(channel.id).then(d => setPresence(d.members)).catch(() => setPresence([]))
  }, [open, channel.id])

  useEffect(() => {
    if (!open) return
    if (!search.trim()) { setCandidates([]); return }
    const ctl = new AbortController()
    fetch(`/api/users/?search=${encodeURIComponent(search)}`, {
      signal: ctl.signal,
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}` },
    })
      .then(r => r.ok ? r.json() : { results: [] })
      .then((d) => {
        const list: UserSearchResult[] = (Array.isArray(d) ? d : d.results) ?? []
        const memberIds = new Set(channel.members.map(m => m.id))
        setCandidates(list.filter(u => !memberIds.has(u.id)).slice(0, 10))
      })
      .catch(() => {})
    return () => ctl.abort()
  }, [search, channel.id, channel.members, open])

  if (!open) return null

  const handleAdd = async (uid: number) => {
    setBusy(true)
    try {
      await chatApi.members.add(channel.id, [uid])
      setSearch('')
      setCandidates([])
      onChanged()
    } finally { setBusy(false) }
  }

  const handleRemove = async (uid: number) => {
    if (!window.confirm('Remove this member from the group?')) return
    setBusy(true)
    try {
      await chatApi.members.remove(channel.id, uid)
      onChanged()
    } finally { setBusy(false) }
  }

  const presenceMap = new Map(presence.map(p => [p.user_id, p]))

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[var(--bg-card-solid,var(--bg-card))] rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col border border-[var(--border)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <div className="font-mono text-xs text-[var(--accent)] uppercase tracking-wider">// members</div>
            <h3 className="font-semibold text-[var(--text)]">{channel.name || 'Group'}</h3>
          </div>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--danger)]">✕</button>
        </div>

        {channel.channel_type === 'group' && (
          <div className="px-4 py-2 border-b border-[var(--border)]">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Add member: search by name or email…"
              className="w-full bg-[var(--bg-hover)] rounded-lg px-3 py-2 text-sm outline-none border border-transparent focus:border-[var(--accent)]"
            />
            {candidates.length > 0 && (
              <div className="mt-2 border border-[var(--border)] rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                {candidates.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleAdd(c.id)}
                    disabled={busy}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-hover)] flex items-center justify-between"
                  >
                    <span>
                      <span className="font-medium">{c.full_name || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || c.email}</span>
                      <span className="text-xs text-[var(--text-secondary)] ml-2">{c.email}</span>
                    </span>
                    <span className="text-[var(--accent)] font-mono text-xs">+ ADD</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="overflow-y-auto flex-1">
          {channel.members.map((m: ChatUser) => {
            const p = presenceMap.get(m.id)
            return (
              <div key={m.id} className="px-5 py-3 flex items-center gap-3 border-b border-[var(--border)]/30">
                <div className="w-9 h-9 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center text-sm font-bold relative shrink-0">
                  {(m.full_name || m.email)[0]?.toUpperCase()}
                  <span className="absolute -bottom-0.5 -right-0.5">
                    <OnlineDot online={!!p?.online} size={10} />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--text)] truncate">{m.full_name || m.email}</div>
                  <div className="text-xs text-[var(--text-secondary)] font-mono">
                    {p?.online ? 'online' : `last seen ${lastSeenText(p?.last_seen ?? null)}`}
                  </div>
                </div>
                {channel.channel_type === 'group' && (
                  <button
                    type="button"
                    onClick={() => handleRemove(m.id)}
                    disabled={busy}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] font-mono px-2 py-1"
                    title="Remove from group"
                  >
                    ✕ KICK
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
