import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/authStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { chatApi, type ChatChannel, type ChatMessage, type ChatUser } from '../api/chat'
import { aiApi, type SentimentResult } from '../api/ai'
import { useChatSocket } from '../hooks/useChatSocket'
import EmojiPicker from '../components/chat/EmojiPicker'
import VoiceRecorder from '../components/chat/VoiceRecorder'
import AudioMessage from '../components/chat/AudioMessage'
import OnlineDot, { ReadCheckmarks, lastSeenText } from '../components/chat/OnlineDot'
import MembersModal from '../components/chat/MembersModal'
import MediaGalleryModal from '../components/chat/MediaGalleryModal'
import api from '../api/client'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '😮', '😢']

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImageMime(mime: string): boolean {
  return mime.startsWith('image/')
}

function isAudioMime(mime: string): boolean {
  return mime.startsWith('audio/')
}

/** Relative timestamp like Telegram: сейчас / 5 мин / вчера / дата */
function formatRelativeTime(dateStr: string, t: ReturnType<typeof useTranslation>['t']): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return t('chat.now')
  if (diffMin < 60) return `${diffMin} мин`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} ч`
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return t('chat.yesterday')
  // Same year: show day/month
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
  }
  return date.toLocaleDateString('ru', { day: 'numeric', month: 'short', year: '2-digit' })
}

/** Render message text with `@handle` tokens highlighted. */
function renderWithMentions(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const re = /@([A-Za-z0-9_.\-]+)/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index))
    parts.push(
      <span
        key={`m-${i++}`}
        className="bg-[var(--accent)]/20 text-[var(--accent)] rounded px-0.5 font-medium"
      >
        @{m[1]}
      </span>,
    )
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

interface AttachmentBubbleProps {
  url: string
  name: string
  size: number
  mime: string
  onOpenImage: (url: string) => void
}

function AttachmentBubble({ url, name, size, mime, onOpenImage }: AttachmentBubbleProps) {
  if (isImageMime(mime)) {
    return (
      <button
        type="button"
        onClick={() => onOpenImage(url)}
        className="block rounded-xl overflow-hidden max-w-[260px] max-h-[260px] bg-[var(--bg-hover)] hover:opacity-95 transition-opacity"
      >
        <img src={url} alt={name} className="block w-full h-full object-cover" loading="lazy" />
      </button>
    )
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border)] px-3 py-2 hover:bg-[var(--bg-main)] transition-colors min-w-[200px] max-w-[300px]"
    >
      <div className="w-9 h-9 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="text-sm font-medium text-[var(--text)] truncate">{name}</div>
        <div className="text-[11px] text-[var(--text-secondary)]">{formatFileSize(size)}</div>
      </div>
    </a>
  )
}

interface CtxMenu {
  msg: ChatMessage
  rect: { top: number; bottom: number; left: number; right: number; width: number }
}

interface WorkspaceMember {
  id: number
  user: number
  user_email: string
  user_name: string
  role: string
}

/** Member picker modal for "New Chat" */
function NewChatModal({
  members,
  currentUserId,
  onSelect,
  onClose,
}: {
  members: WorkspaceMember[]
  currentUserId: number | undefined
  onSelect: (userId: number) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const filtered = members.filter(
    (m) =>
      m.user !== currentUserId &&
      (m.user_name.toLowerCase().includes(search.toLowerCase()) ||
        m.user_email.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-xl)] p-5 w-80 shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[var(--text)]">{t('chat.new_chat_title')}</h3>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--danger)] p-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('chat.search_placeholder')}
          className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-3 py-2 mb-3 focus:outline-none focus:border-[var(--accent)]"
          autoFocus
        />
        <div className="flex-1 overflow-y-auto space-y-0.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] text-center py-4">
              {search ? 'Ничего не найдено' : 'Нет участников'}
            </p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.user}
                onClick={() => onSelect(m.user)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-hover)] transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center text-sm font-bold shrink-0">
                  {(m.user_name || m.user_email)[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--text)] truncate">{m.user_name || m.user_email}</div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">{m.user_email}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/** Group creation modal */
function NewGroupModal({
  members,
  currentUserId,
  onSubmit,
  onClose,
  creating,
}: {
  members: WorkspaceMember[]
  currentUserId: number | undefined
  onSubmit: (name: string, memberIds: number[]) => void
  onClose: () => void
  creating: boolean
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')

  const filterable = members.filter(
    (m) =>
      m.user !== currentUserId &&
      (m.user_name.toLowerCase().includes(search.toLowerCase()) ||
        m.user_email.toLowerCase().includes(search.toLowerCase())),
  )

  const toggle = (userId: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-xl)] p-5 w-[360px] shadow-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[var(--text)]">{t('chat.new_group_title')}</h3>
          <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-[var(--danger)] p-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Group name */}
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1">{t('chat.group_name_label')}</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('chat.group_name_placeholder')}
          className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-3 py-2 mb-3 focus:outline-none focus:border-[var(--accent)]"
          autoFocus
        />

        {/* Members */}
        <label className="text-xs font-medium text-[var(--text-secondary)] mb-1">
          {t('chat.members_label')}{selected.size > 0 && ` (${selected.size})`}
        </label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('chat.search_placeholder')}
          className="w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-3 py-2 mb-2 focus:outline-none focus:border-[var(--accent)]"
        />
        <div className="flex-1 overflow-y-auto space-y-0.5 mb-4 max-h-48">
          {filterable.map((m) => {
            const checked = selected.has(m.user)
            return (
              <button
                key={m.user}
                onClick={() => toggle(m.user)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors text-left ${checked ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--bg-hover)]'}`}
              >
                {/* Checkbox */}
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-[var(--border)]'}`}>
                  {checked && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
                <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center text-xs font-bold shrink-0">
                  {(m.user_name || m.user_email)[0]?.toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-[var(--text)] truncate">{m.user_name || m.user_email}</div>
                  <div className="text-xs text-[var(--text-secondary)] truncate">{m.user_email}</div>
                </div>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => name.trim() && onSubmit(name.trim(), Array.from(selected))}
          disabled={!name.trim() || creating}
          className="w-full py-2.5 rounded-[var(--radius-lg)] bg-[var(--accent)] text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {creating ? t('chat.creating') : t('chat.create_group')}
        </button>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const currentSlug = useWorkspaceStore((s) => s.currentSlug)

  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [pinnedIds, setPinnedIds] = useState<Set<number>>(new Set())
  const [pinnedIdx, setPinnedIdx] = useState(0)
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null)
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingText, setEditingText] = useState('')
  const [messageSearch, setMessageSearch] = useState('')
  const [searchResults, setSearchResults] = useState<ChatMessage[] | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [presence, setPresence] = useState<Record<number, { online: boolean; last_seen: string | null; name: string }>>({})
  const [membersOpen, setMembersOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const ctxRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingPreview, setPendingPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [sentiment, setSentiment] = useState<SentimentResult | null>(null)
  const [sentimentLoading, setSentimentLoading] = useState(false)

  // Channel search
  const [channelSearch, setChannelSearch] = useState('')

  // + button dropdown
  const [plusOpen, setPlusOpen] = useState(false)
  const plusRef = useRef<HTMLDivElement>(null)

  // Modals
  const [showNewChat, setShowNewChat] = useState(false)
  const [showNewGroup, setShowNewGroup] = useState(false)
  const [creatingGroup, setCreatingGroup] = useState(false)

  // Workspace members (for modals)
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([])

  // Load workspace members when slug is known
  useEffect(() => {
    if (!currentSlug) return
    api.get(`/workspaces/${currentSlug}/members/`)
      .then((r) => setWorkspaceMembers(r.data))
      .catch(() => {})
  }, [currentSlug])

  // Close + dropdown on outside click
  useEffect(() => {
    if (!plusOpen) return
    const handler = (e: MouseEvent) => {
      if (plusRef.current && !plusRef.current.contains(e.target as Node)) {
        setPlusOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [plusOpen])

  // Reset sentiment when switching channel
  useEffect(() => {
    setSentiment(null)
  }, [activeChannelId])

  const runSentiment = async () => {
    if (!activeChannelId) return
    setSentimentLoading(true)
    try {
      const r = await aiApi.chatSentiment(activeChannelId)
      setSentiment(r)
    } finally {
      setSentimentLoading(false)
    }
  }

  const loadChannels = useCallback(async () => {
    try {
      const list = await chatApi.channels.list()
      setChannels(list)
      if (list.length > 0) {
        setActiveChannelId((current) => current ?? list[0].id)
      }
    } finally {
      setLoadingChannels(false)
    }
  }, [])

  useEffect(() => {
    loadChannels()
  }, [loadChannels])

  useEffect(() => {
    if (!activeChannelId) return
    setLoadingMessages(true)
    setMessages([])
    chatApi.messages.list(activeChannelId).then(setMessages).finally(() => setLoadingMessages(false))
  }, [activeChannelId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Close context menu on click outside
  useEffect(() => {
    if (!ctxMenu) return
    const handler = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setCtxMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ctxMenu])

  const handleNewMessage = useCallback((msg: ChatMessage) => {
    if (msg.channel === activeChannelId) {
      // Dedupe: WS broadcast can race with the POST response that already added the message.
      setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])
    }
    setChannels((prev) => {
      const updated = prev.map((ch) =>
        ch.id === msg.channel
          ? { ...ch, last_message: { text: msg.text, author: msg.author?.full_name ?? '', created_at: msg.created_at } }
          : ch
      )
      // Re-sort by last_message time (most recent on top)
      return [...updated].sort((a, b) => {
        const aTime = a.last_message?.created_at ?? a.created_at
        const bTime = b.last_message?.created_at ?? b.created_at
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      })
    })
  }, [activeChannelId])

  const handleReaction = useCallback(() => {
    if (activeChannelId) chatApi.messages.list(activeChannelId).then(setMessages)
  }, [activeChannelId])

  // Typing indicator state: map of user_id → {name, lastTs}
  const [typingUsers, setTypingUsers] = useState<Record<number, { name: string; ts: number }>>({})
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTypingEmitRef = useRef<number>(0)

  const handleTyping = useCallback((evt: { user_id: number; user_name: string; is_typing: boolean }) => {
    setTypingUsers((prev) => {
      const next = { ...prev }
      if (evt.is_typing) {
        next[evt.user_id] = { name: evt.user_name, ts: Date.now() }
      } else {
        delete next[evt.user_id]
      }
      return next
    })
  }, [])

  // Garbage-collect stale typing indicators every 2s
  useEffect(() => {
    const id = setInterval(() => {
      setTypingUsers((prev) => {
        const now = Date.now()
        const next: typeof prev = {}
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.ts < 4000) next[Number(k)] = v
        }
        return next
      })
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const handleEdited = useCallback((msg: ChatMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)))
  }, [])
  const handleDeleted = useCallback((id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }, [])
  const handlePresence = useCallback((evt: { user_id: number; user_name: string; online: boolean; last_seen: string | null }) => {
    setPresence((prev) => ({
      ...prev,
      [evt.user_id]: { online: evt.online, last_seen: evt.last_seen, name: evt.user_name },
    }))
  }, [])
  const handleMessageRead = useCallback((evt: { message_id: number; user_id: number }) => {
    setMessages((prev) => prev.map((m) => {
      if (m.id !== evt.message_id) return m
      const rb = new Set(m.read_by ?? [])
      rb.add(evt.user_id)
      return { ...m, read_by: Array.from(rb) }
    }))
  }, [])

  const { connected, sendMessage, sendReaction, sendTyping } = useChatSocket({
    channelId: activeChannelId,
    onMessage: handleNewMessage,
    onReaction: handleReaction,
    onTyping: handleTyping,
    onEdited: handleEdited,
    onDeleted: handleDeleted,
    onPresence: handlePresence,
    onMessageRead: handleMessageRead,
  })

  // Initial presence load when active channel changes
  useEffect(() => {
    if (!activeChannelId) return
    chatApi.presence.list(activeChannelId).then(d => {
      const map: Record<number, { online: boolean; last_seen: string | null; name: string }> = {}
      for (const m of d.members) map[m.user_id] = { online: m.online, last_seen: m.last_seen, name: m.name }
      setPresence(map)
    }).catch(() => {})
  }, [activeChannelId])

  // Mark unread messages as read after they show up
  useEffect(() => {
    if (!activeChannelId || !user || messages.length === 0) return
    const unreadIds = messages
      .filter(m => m.author && m.author.id !== user.id)
      .filter(m => !(m.read_by ?? []).includes(user.id))
      .map(m => m.id)
    if (unreadIds.length === 0) return
    const t = setTimeout(() => {
      chatApi.messages.markRead(activeChannelId, unreadIds).catch(() => {})
    }, 700)
    return () => clearTimeout(t)
  }, [activeChannelId, messages, user])

  const submitEdit = async () => {
    if (editingId == null) return
    const newText = editingText.trim()
    if (!newText) { setEditingId(null); return }
    try {
      const updated = await chatApi.messages.edit(editingId, newText)
      setMessages((prev) => prev.map((m) => (m.id === editingId ? { ...m, ...updated } : m)))
    } catch { /* server-side error */ }
    setEditingId(null)
    setEditingText('')
  }

  const runMessageSearch = async (q: string) => {
    if (!activeChannelId || !q.trim()) {
      setSearchResults(null)
      return
    }
    try {
      const data = await chatApi.messages.search(activeChannelId, q.trim())
      setSearchResults(data.results)
    } catch { setSearchResults([]) }
  }

  const handleVoiceSend = async (blob: Blob, durationSec: number) => {
    if (!activeChannelId) return
    setUploading(true)
    try {
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || 'audio/webm' })
      await chatApi.messages.sendWithAttachment(
        activeChannelId,
        `🎤 voice · ${durationSec}s`,
        file,
        replyTo?.id,
      )
      setReplyTo(null)
    } finally {
      setUploading(false)
    }
  }

  // Debounced typing emit on input change
  const emitTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingEmitRef.current > 2000) {
      sendTyping?.(true)
      lastTypingEmitRef.current = now
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    typingTimerRef.current = setTimeout(() => {
      sendTyping?.(false)
      lastTypingEmitRef.current = 0
    }, 2500)
  }, [sendTyping])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeChannelId) return
    if (pendingFile) {
      setUploading(true)
      try {
        const created = await chatApi.messages.sendWithAttachment(
          activeChannelId,
          input.trim(),
          pendingFile,
          replyTo?.id,
        )
        // Add directly — the WS broadcast (also coming) is deduped by id in handleNewMessage
        setMessages((prev) => prev.some((m) => m.id === created.id) ? prev : [...prev, created])
        setPendingFile(null)
        if (pendingPreview) URL.revokeObjectURL(pendingPreview)
        setPendingPreview(null)
        setInput('')
        setReplyTo(null)
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
      return
    }
    if (!input.trim()) return
    // Try WS first (instant); fall back to REST POST if not connected
    if (connected) {
      sendMessage(input.trim(), replyTo?.id)
    } else {
      try {
        const created = await chatApi.messages.sendWithAttachment(
          activeChannelId, input.trim(), new File([], ''), replyTo?.id,
        )
        setMessages((prev) => prev.some((m) => m.id === created.id) ? prev : [...prev, created])
      } catch {
        // last resort — at least keep the input populated so user can retry
        return
      }
    }
    setInput('')
    setReplyTo(null)
  }

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    if (file.type.startsWith('image/')) {
      setPendingPreview(URL.createObjectURL(file))
    } else {
      setPendingPreview(null)
    }
  }

  const clearPendingFile = () => {
    setPendingFile(null)
    if (pendingPreview) URL.revokeObjectURL(pendingPreview)
    setPendingPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const insertEmoji = (emoji: string) => {
    setInput((prev) => prev + emoji)
  }

  // @mention autocomplete
  const [mentionState, setMentionState] = useState<{ query: string; start: number } | null>(null)
  const [mentionIdx, setMentionIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const activeChannel = channels.find((c) => c.id === activeChannelId)
  const mentionCandidates = (activeChannel?.members ?? []).filter((m) => {
    if (!mentionState) return false
    const q = mentionState.query.toLowerCase()
    return (
      (m.full_name || '').toLowerCase().includes(q) ||
      (m.email || '').split('@')[0].toLowerCase().includes(q)
    )
  }).slice(0, 5)

  const updateMentionState = (value: string, caret: number) => {
    const before = value.slice(0, caret)
    const atIdx = before.lastIndexOf('@')
    if (atIdx === -1) { setMentionState(null); return }
    const segment = before.slice(atIdx + 1)
    if (/\s/.test(segment) || segment.length > 30) { setMentionState(null); return }
    if (atIdx > 0 && !/\s/.test(before[atIdx - 1])) { setMentionState(null); return }
    setMentionState({ query: segment, start: atIdx })
    setMentionIdx(0)
  }

  const pickMention = (u: ChatUser) => {
    if (!mentionState) return
    const handle = (u.email || '').split('@')[0] || u.full_name.split(' ')[0]
    const before = input.slice(0, mentionState.start)
    const after = input.slice(inputRef.current?.selectionStart ?? input.length)
    const next = `${before}@${handle} ${after}`
    setInput(next)
    setMentionState(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // Anchor the context menu to the BUBBLE, not the click coordinates.
  // The menu has two parts (Telegram-style):
  //   - reaction picker rendered ABOVE the bubble
  //   - actions list rendered BELOW the bubble
  const captureBubbleRect = (target: HTMLElement | null) => {
    // Find the closest bubble element (the .group wrapper has the message anchor)
    const node = target?.closest<HTMLElement>("[id^='msg-']")
    const r = (node ?? target)?.getBoundingClientRect()
    if (!r) return null
    return {
      top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width,
    }
  }

  const handleContextMenu = (e: React.MouseEvent, msg: ChatMessage) => {
    e.preventDefault()
    const rect = captureBubbleRect(e.currentTarget as HTMLElement)
    if (!rect) return
    setCtxMenu({ msg, rect })
  }

  // Long-press (touch ≥ 500ms) opens the context menu.
  // Double-tap (two taps within 300ms) opens the reaction quick-picker.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTapAtRef = useRef<{ msgId: number; t: number } | null>(null)

  const handleTouchStart = (e: React.TouchEvent, msg: ChatMessage) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
    const target = e.currentTarget as HTMLElement
    const rect = captureBubbleRect(target)
    longPressTimer.current = setTimeout(() => {
      if (rect) setCtxMenu({ msg, rect })
      longPressTimer.current = null
    }, 500)

    // Double-tap detection
    const now = Date.now()
    const last = lastTapAtRef.current
    if (last && last.msgId === msg.id && now - last.t < 300) {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
      lastTapAtRef.current = null
      if (rect) {
        setReactPickerFor({
          msgId: msg.id,
          x: Math.max(8, Math.min(rect.left, window.innerWidth - 280)),
          y: Math.max(8, rect.top - 56),
        })
      }
    } else {
      lastTapAtRef.current = { msgId: msg.id, t: now }
    }
  }
  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  // Inline reaction picker — small bubble next to the message, independent of ctxMenu.
  const [reactPickerFor, setReactPickerFor] = useState<{ msgId: number; x: number; y: number } | null>(null)
  const reactPickerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!reactPickerFor) return
    const handler = (e: MouseEvent) => {
      if (reactPickerRef.current && !reactPickerRef.current.contains(e.target as Node)) {
        setReactPickerFor(null)
      }
    }
    // Delay so the click that opened it doesn't immediately close it
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', handler)
    }
  }, [reactPickerFor])

  const openReactionPickerForMessage = (msg: ChatMessage, anchor: HTMLElement) => {
    const r = anchor.getBoundingClientRect()
    setReactPickerFor({
      msgId: msg.id,
      x: Math.max(8, Math.min(r.left, window.innerWidth - 240)),
      y: Math.max(8, r.top - 48),
    })
  }

  // Optimistic toggle: flip the local state synchronously, fire REST in the background.
  // On failure, reload from server to recover. Mirrors Telegram's instant-feedback feel.
  const optimisticReact = useCallback((msgId: number, emoji: string) => {
    if (!user) return
    setMessages((prev) => prev.map((m) => {
      if (m.id !== msgId) return m
      const mine = m.reactions.find((r) => r.emoji === emoji && r.user?.id === user.id)
      if (mine) {
        return { ...m, reactions: m.reactions.filter((r) => r.id !== mine.id) }
      }
      const stub = {
        id: -Date.now(),
        emoji,
        user: { id: user.id, email: user.email, full_name: user.full_name, avatar: user.avatar ?? null },
      } as ChatReaction
      return { ...m, reactions: [...m.reactions, stub] }
    }))
    chatApi.messages.react(msgId, emoji).catch(() => {
      if (activeChannelId) chatApi.messages.list(activeChannelId).then(setMessages)
    })
  }, [user, activeChannelId])

  const reactPickerSend = (emoji: string) => {
    if (!reactPickerFor) return
    const msgId = reactPickerFor.msgId
    setReactPickerFor(null)
    optimisticReact(msgId, emoji)
  }

  const ctxReply = () => { if (!ctxMenu) return; setReplyTo(ctxMenu.msg); setCtxMenu(null) }
  const ctxForward = () => { if (!ctxMenu) return; setForwardMsg(ctxMenu.msg); setCtxMenu(null) }
  const ctxPin = () => {
    if (!ctxMenu) return
    const id = ctxMenu.msg.id
    setPinnedIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
    chatApi.messages.pin(id).catch(() => {})
    setCtxMenu(null)
  }
  const ctxCopy = () => { if (!ctxMenu) return; navigator.clipboard.writeText(ctxMenu.msg.text).catch(() => {}); setCtxMenu(null) }
  const ctxReact = (emoji: string) => {
    if (!ctxMenu) return
    const msgId = ctxMenu.msg.id
    setCtxMenu(null)
    optimisticReact(msgId, emoji)
  }
  const ctxEdit = () => { if (!ctxMenu) return; setEditingId(ctxMenu.msg.id); setEditingText(ctxMenu.msg.text); setCtxMenu(null) }
  const ctxDelete = async () => {
    if (!ctxMenu) return
    const id = ctxMenu.msg.id
    setCtxMenu(null)
    if (!window.confirm('Delete this message for everyone?')) return
    try {
      await chatApi.messages.delete(id)
      setMessages((prev) => prev.filter((m) => m.id !== id))
    } catch (e) {
      // optimistic — silently fail; the WS broadcast will eventually reconcile
    }
  }

  const handleForward = (targetChannelId: number) => {
    if (!forwardMsg) return
    if (targetChannelId !== activeChannelId) setActiveChannelId(targetChannelId)
    chatApi.messages.forward(forwardMsg.id, targetChannelId).catch(() => {})
    setForwardMsg(null)
  }

  const scrollToPinned = useCallback(() => {
    const arr = Array.from(pinnedIds)
    if (arr.length === 0) return
    const idx = pinnedIdx % arr.length
    const id = arr[idx]
    const el = document.getElementById(`msg-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.remove('msg-highlight')
      void el.offsetWidth
      el.classList.add('msg-highlight')
    }
    setPinnedIdx((i) => (i + 1) % arr.length)
  }, [pinnedIds, pinnedIdx])

  // Open DM with a user (from member picker)
  const handleStartDM = async (userId: number) => {
    setShowNewChat(false)
    try {
      const ch = await chatApi.channels.direct(userId)
      setChannels((prev) => {
        const exists = prev.find((c) => c.id === ch.id)
        if (exists) return prev
        return [ch, ...prev]
      })
      setActiveChannelId(ch.id)
    } catch {}
  }

  // Create group channel
  const handleCreateGroup = async (name: string, memberIds: number[]) => {
    setCreatingGroup(true)
    try {
      const ch = await chatApi.channels.create({ name, channel_type: 'group', member_ids: memberIds })
      setChannels((prev) => [ch, ...prev])
      setActiveChannelId(ch.id)
      setShowNewGroup(false)
    } catch {
      // error — keep modal open
    } finally {
      setCreatingGroup(false)
    }
  }

  // Filtered channel list for sidebar search
  const filteredChannels = channelSearch.trim()
    ? channels.filter((ch) => {
        const name = (ch as ChatChannel & { display_name?: string }).display_name
          || (ch.channel_type === 'direct'
            ? ch.members.find((m) => m.id !== user?.id)?.full_name || ''
            : ch.name || '')
        return name.toLowerCase().includes(channelSearch.toLowerCase())
      })
    : channels

  // Helper: get display name for a channel
  const getChannelName = (ch: ChatChannel) => {
    const extended = ch as ChatChannel & { display_name?: string }
    if (extended.display_name) return extended.display_name
    if (ch.channel_type === 'direct') {
      return ch.members.find((m) => m.id !== user?.id)?.full_name || 'Direct'
    }
    return ch.name || `Group #${ch.id}`
  }

  const getChannelInitial = (ch: ChatChannel) => {
    if (ch.channel_type === 'direct') {
      return ch.members.find((m) => m.id !== user?.id)?.full_name?.[0]?.toUpperCase() ?? '?'
    }
    return ch.name?.[0]?.toUpperCase() ?? '#'
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem-3rem)] rounded-[var(--radius-xl)] border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">

      {/* ── Sidebar ──
          On mobile we use a single-pane navigation: the sidebar takes the full
          width when no channel is open, and is hidden when a channel is open.
          On md+ both panels show side-by-side. */}
      <div className={`md:w-72 md:border-r md:border-[var(--border)] flex flex-col shrink-0 ${activeChannelId ? 'hidden md:flex' : 'w-full md:flex'}`}>

        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
          <h2 className="text-sm font-semibold text-[var(--text)] flex-1">{t('nav.chat')}</h2>

          {/* + button */}
          <div className="relative" ref={plusRef}>
            <button
              onClick={() => setPlusOpen((v) => !v)}
              className="w-7 h-7 rounded-full flex items-center justify-center bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors font-semibold text-lg leading-none"
              title="Новый чат"
            >
              +
            </button>
            {plusOpen && (
              <div className="absolute right-0 top-9 z-30 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl w-44 overflow-hidden">
                <button
                  onClick={() => { setPlusOpen(false); setShowNewChat(true) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors text-left"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  {t('chat.new_chat')}
                </button>
                <button
                  onClick={() => { setPlusOpen(false); setShowNewGroup(true) }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors text-left"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  {t('chat.new_group')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-[var(--border)]">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              value={channelSearch}
              onChange={(e) => setChannelSearch(e.target.value)}
              placeholder={t('chat.search_placeholder')}
              className="w-full pl-8 pr-3 py-1.5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>
        </div>

        {/* Channel list */}
        <div className="flex-1 overflow-y-auto">
          {loadingChannels ? (
            <div className="p-4 text-xs text-[var(--text-secondary)]">{t('common.loading')}</div>
          ) : filteredChannels.length === 0 ? (
            <div className="p-5 text-center">
              {channels.length === 0 ? (
                <>
                  <div className="text-3xl mb-2 opacity-30">💬</div>
                  <p className="text-xs text-[var(--text-secondary)] mb-3">{t('chat.noChannelsHint')}</p>
                  <button
                    onClick={() => setShowNewChat(true)}
                    className="text-xs text-[var(--accent)] hover:underline font-medium"
                  >
                    {t('chat.newChatBtn')}
                  </button>
                </>
              ) : (
                <p className="text-xs text-[var(--text-secondary)]">Не найдено</p>
              )}
            </div>
          ) : (
            filteredChannels.map((ch) => {
              const isActive = activeChannelId === ch.id
              const name = getChannelName(ch)
              const initial = getChannelInitial(ch)
              const isDM = ch.channel_type === 'direct'
              const lastMsg = ch.last_message
              const timeStr = lastMsg?.created_at ? formatRelativeTime(lastMsg.created_at, t) : ''
              const unread = ch.unread_count ?? 0

              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannelId(ch.id)}
                  className={`w-full text-left px-3 py-3 transition-colors border-b border-[var(--border)]/40
                    ${isActive ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--bg-hover)]'}`}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                      ${isDM ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'}`}>
                      {initial}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Name + timestamp row */}
                      <div className="flex items-baseline justify-between gap-1">
                        <span className={`text-sm truncate ${isActive ? 'font-semibold text-[var(--text)]' : 'font-medium text-[var(--text)]'}`}>
                          {name}
                        </span>
                        {timeStr && (
                          <span className="text-[10px] text-[var(--text-secondary)] shrink-0">{timeStr}</span>
                        )}
                      </div>

                      {/* Preview + unread row */}
                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <span className="text-xs text-[var(--text-secondary)] truncate flex-1">
                          {lastMsg
                            ? `${lastMsg.author ? lastMsg.author + ': ' : ''}${lastMsg.text}`
                            : isDM ? 'Нет сообщений' : `${ch.members.length} участников`}
                        </span>
                        {unread > 0 && (
                          <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-[var(--accent)] text-white text-[10px] font-bold flex items-center justify-center px-1">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ── Chat area ── */}
      {activeChannelId ? (
        <div className={`flex-1 flex flex-col overflow-hidden ${activeChannelId ? 'flex' : 'hidden md:flex'}`}>
          {/* Header */}
          <div className="px-3 sm:px-4 py-3 border-b border-[var(--border)] flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Mobile back button */}
            <button
              type="button"
              onClick={() => setActiveChannelId(null)}
              className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)] transition-colors shrink-0"
              aria-label="Back to channel list"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
              ${activeChannel?.channel_type === 'direct' ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]'}`}>
              {activeChannel ? getChannelInitial(activeChannel) : '?'}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--text)] flex items-center gap-2 truncate">
                {activeChannel ? getChannelName(activeChannel) : ''}
                {activeChannel?.channel_type === 'direct' && (() => {
                  const peer = activeChannel.members.find(m => m.id !== user?.id)
                  if (!peer) return null
                  const p = presence[peer.id]
                  return p ? <OnlineDot online={p.online} size={9} title={p.online ? 'Online' : `Last seen ${lastSeenText(p.last_seen)}`} /> : null
                })()}
              </div>
              <div className="text-xs text-[var(--text-secondary)] font-mono truncate">
                {activeChannel?.channel_type === 'group' ? (
                  (() => {
                    const onlineCount = activeChannel.members.filter(m => presence[m.id]?.online).length
                    return `${activeChannel.members.length} members${onlineCount ? ` · ${onlineCount} online` : ''}`
                  })()
                ) : (
                  (() => {
                    const peer = activeChannel?.members.find(m => m.id !== user?.id)
                    const p = peer ? presence[peer.id] : null
                    if (!p) return connected ? t('chat.online') : t('chat.connecting')
                    return p.online ? 'online' : `last seen ${lastSeenText(p.last_seen)}`
                  })()
                )}
              </div>
            </div>
            <button
              onClick={runSentiment}
              disabled={sentimentLoading}
              className="hidden sm:inline-flex ml-auto px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--accent)] border border-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-50 transition-colors"
              title="AI анализ тональности переписки"
            >
              {sentimentLoading ? '...' : 'AI sentiment'}
            </button>
            <button
              onClick={runSentiment}
              disabled={sentimentLoading}
              className="sm:hidden ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-[var(--accent)] border border-[var(--accent)] hover:bg-[var(--accent)]/10 disabled:opacity-50 transition-colors shrink-0"
              title="AI анализ тональности переписки"
              aria-label="AI sentiment"
            >
              ★
            </button>
            <button
              type="button"
              onClick={() => { setSearchOpen((v) => !v); if (searchOpen) { setMessageSearch(''); setSearchResults(null) } }}
              className={`ml-1 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${searchOpen ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)]'}`}
              title="Search messages"
              aria-label="Search messages"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setGalleryOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)]"
              title="Media gallery"
              aria-label="Media gallery"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent)]"
              title={activeChannel?.channel_type === 'group' ? 'Manage members' : 'Show member info'}
              aria-label="Members"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </button>
            {/* Pinned banner */}
            {pinnedIds.size > 0 && (() => {
              const arr = Array.from(pinnedIds)
              const currentId = arr[pinnedIdx % arr.length]
              const currentMsg = messages.find((m) => m.id === currentId)
              return (
                <button
                  type="button"
                  onClick={scrollToPinned}
                  className="ml-auto flex items-center gap-2 bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 rounded-full px-3 py-1.5 transition-colors text-left min-w-0 max-w-xs"
                >
                  <span className="text-xs shrink-0">📌</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[var(--accent)]">
                      {t('chat.pinned')}{arr.length > 1 ? ` (${pinnedIdx % arr.length + 1}/${arr.length})` : ''}
                    </div>
                    {currentMsg && (
                      <div className="text-xs text-[var(--text-secondary)] truncate">{currentMsg.text}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPinnedIds(new Set()); setPinnedIdx(0) }}
                    className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] shrink-0 ml-1"
                  >✕</button>
                </button>
              )
            })()}
          </div>

          {/* Message search bar */}
          {searchOpen && (
            <div className="px-4 py-2 border-b border-[var(--border)] flex items-center gap-2 bg-[var(--bg-hover)]/30">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)] shrink-0">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                autoFocus
                value={messageSearch}
                onChange={(e) => { setMessageSearch(e.target.value); runMessageSearch(e.target.value) }}
                placeholder="Search in this channel…"
                className="flex-1 bg-transparent outline-none text-sm text-[var(--text)] placeholder-[var(--text-secondary)]"
              />
              {searchResults && (
                <span className="text-xs text-[var(--text-secondary)] font-mono">{searchResults.length} hit{searchResults.length === 1 ? '' : 's'}</span>
              )}
              <button
                type="button"
                onClick={() => { setSearchOpen(false); setMessageSearch(''); setSearchResults(null) }}
                className="text-[var(--text-secondary)] hover:text-[var(--danger)] shrink-0"
                aria-label="Close search"
              >✕</button>
            </div>
          )}

          {/* Search result panel */}
          {searchOpen && searchResults && searchResults.length > 0 && (
            <div className="border-b border-[var(--border)] bg-[var(--bg-hover)]/20 max-h-48 overflow-y-auto">
              {searchResults.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    const el = document.getElementById(`msg-${m.id}`)
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      el.classList.remove('msg-highlight'); void el.offsetWidth; el.classList.add('msg-highlight')
                    }
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-[var(--bg-hover)] border-b border-[var(--border)]/40"
                >
                  <div className="text-xs font-semibold text-[var(--accent)]">{m.author?.full_name ?? '—'}</div>
                  <div className="text-sm text-[var(--text)] truncate">{m.text}</div>
                  <div className="text-[10px] text-[var(--text-secondary)] font-mono">{new Date(m.created_at).toLocaleString()}</div>
                </button>
              ))}
            </div>
          )}

          {/* Sentiment banner */}
          {sentiment && (
            <div className={`px-4 py-3 border-b border-[var(--border)] ${
              sentiment.sentiment === 'negative' || sentiment.sentiment === 'at_risk'
                ? 'bg-red-500/10'
                : sentiment.sentiment === 'positive'
                ? 'bg-green-500/10'
                : sentiment.sentiment === 'mixed'
                ? 'bg-orange-500/10'
                : 'bg-[var(--bg-hover)]'
            }`}>
              <div className="flex items-start gap-3">
                <span className="text-lg shrink-0">
                  {sentiment.sentiment === 'positive' && '😊'}
                  {sentiment.sentiment === 'neutral' && '😐'}
                  {sentiment.sentiment === 'mixed' && '😕'}
                  {sentiment.sentiment === 'negative' && '😟'}
                  {sentiment.sentiment === 'at_risk' && '🚨'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[var(--text)] uppercase tracking-wider">
                    Sentiment: {sentiment.sentiment} · score {sentiment.score}
                  </div>
                  {sentiment.reason && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{sentiment.reason}</p>}
                  {sentiment.signals && sentiment.signals.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {sentiment.signals.slice(0, 5).map((s, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-secondary)]">"{s.slice(0, 60)}"</span>
                      ))}
                    </div>
                  )}
                  {sentiment.recommended_action && (
                    <p className="text-xs text-[var(--accent)] mt-1.5"><b>Action:</b> {sentiment.recommended_action}</p>
                  )}
                </div>
                <button onClick={() => setSentiment(null)} className="text-[var(--text-secondary)] hover:text-[var(--danger)] shrink-0" title="Закрыть">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
            {loadingMessages ? (
              <div className="text-xs text-[var(--text-secondary)] text-center py-8">{t('common.loading')}</div>
            ) : messages.length === 0 ? (
              <div className="text-xs text-center text-[var(--text-secondary)] py-12">
                <div className="text-3xl mb-2">💬</div>
                {t('chat.noMessagesHint')}
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isOwn = msg.author?.id === user?.id
                const prevMsg = messages[idx - 1]
                const sameAuthor = prevMsg && prevMsg.author?.id === msg.author?.id
                const isPinned = pinnedIds.has(msg.id)

                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className={`group flex gap-2 ${isOwn ? 'flex-row-reverse' : ''} ${sameAuthor ? 'mt-0.5' : 'mt-3'} ${ctxMenu?.msg.id === msg.id ? 'relative z-50' : ''}`}
                    onContextMenu={(e) => handleContextMenu(e, msg)}
                    onTouchStart={(e) => handleTouchStart(e, msg)}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                    onTouchMove={handleTouchEnd}
                  >
                    <div className="w-8 shrink-0">
                      {!sameAuthor && !isOwn && (
                        <div className="w-8 h-8 rounded-full bg-[var(--accent)]/20 flex items-center justify-center text-xs font-bold text-[var(--accent)]">
                          {msg.author?.full_name?.[0] ?? '?'}
                        </div>
                      )}
                    </div>

                    <div className={`max-w-[70%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                      {!sameAuthor && !isOwn && (
                        <span className="text-xs font-semibold text-[var(--accent)] px-1">{msg.author?.full_name}</span>
                      )}

                      {msg.reply_to_preview && (
                        <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] rounded-lg px-2.5 py-1.5 border-l-2 border-[var(--accent)] max-w-full">
                          <span className="font-medium">{msg.reply_to_preview.author}</span>
                          <p className="truncate opacity-80">{msg.reply_to_preview.text}</p>
                        </div>
                      )}

                      {msg.forwarded_from_preview && (
                        <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1 px-2 font-mono">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>
                          </svg>
                          Forwarded from <span className="text-[var(--accent)]">{msg.forwarded_from_preview.author}</span>
                        </div>
                      )}

                      {msg.attachment_url && isImageMime(msg.attachment_mime) && (
                        <AttachmentBubble
                          url={msg.attachment_url}
                          name={msg.attachment_name}
                          size={msg.attachment_size}
                          mime={msg.attachment_mime}
                          onOpenImage={setLightbox}
                        />
                      )}

                      {msg.attachment_url && isAudioMime(msg.attachment_mime) && (
                        <div className={`rounded-2xl px-3 py-2 ${isOwn ? 'bg-[var(--accent)]/15' : 'bg-[var(--bg-hover)]'} ${isPinned ? 'ring-1 ring-[var(--accent)]/40' : ''}`}>
                          <AudioMessage
                            src={msg.attachment_url}
                            fileName={msg.attachment_name}
                            sizeBytes={msg.attachment_size}
                          />
                        </div>
                      )}

                      {(msg.text || (msg.attachment_url && !isImageMime(msg.attachment_mime) && !isAudioMime(msg.attachment_mime))) && (
                      <div className={`relative rounded-2xl px-3 py-2 text-sm leading-relaxed
                        ${isOwn ? 'bg-[var(--accent)] text-white rounded-tr-sm' : 'bg-[var(--bg-hover)] text-[var(--text)] rounded-tl-sm'}
                        ${isPinned ? 'ring-1 ring-[var(--accent)]/40' : ''}`}>
                        {isPinned && <span className="absolute -top-1.5 -right-1 text-xs">📌</span>}
                        {msg.attachment_url && !isImageMime(msg.attachment_mime) && !isAudioMime(msg.attachment_mime) && (
                          <div className="mb-1.5">
                            <AttachmentBubble
                              url={msg.attachment_url}
                              name={msg.attachment_name}
                              size={msg.attachment_size}
                              mime={msg.attachment_mime}
                              onOpenImage={setLightbox}
                            />
                          </div>
                        )}
                        {editingId === msg.id ? (
                          <div className="flex flex-col gap-1.5 min-w-[220px]">
                            <textarea
                              autoFocus
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitEdit() }
                                if (e.key === 'Escape') { setEditingId(null); setEditingText('') }
                              }}
                              className="w-full bg-[var(--bg-card-solid,var(--bg-card))] text-[var(--text)] rounded-md p-2 text-sm resize-none border border-[var(--accent)] outline-none"
                              rows={Math.max(2, Math.min(6, editingText.split('\n').length + 1))}
                            />
                            <div className="flex gap-2 justify-end text-xs">
                              <button type="button" onClick={() => { setEditingId(null); setEditingText('') }} className="text-[var(--text-secondary)] hover:text-[var(--text)]">Cancel</button>
                              <button type="button" onClick={submitEdit} className="text-[var(--accent)] font-semibold hover:underline">Save</button>
                            </div>
                          </div>
                        ) : (
                          msg.text && (
                            <p className="whitespace-pre-wrap break-words">
                              {renderWithMentions(msg.text)}
                              {msg.is_edited && <span className="text-[10px] opacity-60 ml-2">(edited)</span>}
                            </p>
                          )
                        )}
                        <span className={`text-[10px] mt-0.5 float-right ml-3 inline-flex items-center ${isOwn ? 'text-white/60' : 'text-[var(--text-secondary)]'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          <ReadCheckmarks
                            readBy={msg.read_by}
                            hasMembers={activeChannel?.members.length ?? 1}
                            isOwn={isOwn}
                          />
                        </span>
                      </div>
                      )}

                      {msg.reactions.length > 0 && (
                        <div className={`flex items-center gap-1 flex-wrap ${isOwn ? 'flex-row-reverse' : ''}`}>
                          {(() => {
                            const grouped = new Map<string, { count: number; mine: boolean }>()
                            for (const r of msg.reactions) {
                              const cur = grouped.get(r.emoji) ?? { count: 0, mine: false }
                              cur.count += 1
                              if (r.user?.id === user?.id) cur.mine = true
                              grouped.set(r.emoji, cur)
                            }
                            return Array.from(grouped.entries()).map(([emoji, { count, mine }]) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => optimisticReact(msg.id, emoji)}
                                className={`text-xs rounded-full px-1.5 py-0.5 transition-colors ${
                                  mine
                                    ? 'bg-[var(--accent)]/20 border border-[var(--accent)] text-[var(--accent)]'
                                    : 'bg-[var(--bg-hover)] border border-[var(--border)] hover:border-[var(--accent)]'
                                }`}
                                title={mine ? 'Click to remove your reaction' : 'Click to add this reaction'}
                              >
                                {emoji} {count}
                              </button>
                            ))
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply strip */}
          {replyTo && (
            <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-2 bg-[var(--bg-hover)]">
              <div className="w-0.5 h-8 bg-[var(--accent)] rounded-full shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-[var(--accent)]">{replyTo.author?.full_name}</div>
                <div className="text-xs text-[var(--text-secondary)] truncate">{replyTo.text}</div>
              </div>
              <button onClick={() => setReplyTo(null)} className="text-[var(--text-secondary)] hover:text-[var(--danger)] p-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}

          {/* Pending attachment preview */}
          {pendingFile && (
            <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg-hover)] flex items-center gap-3">
              {pendingPreview ? (
                <img src={pendingPreview} alt={pendingFile.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text)] truncate">{pendingFile.name}</div>
                <div className="text-xs text-[var(--text-secondary)]">{formatFileSize(pendingFile.size)}</div>
              </div>
              <button
                type="button"
                onClick={clearPendingFile}
                className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}

          {/* Typing indicator */}
          {Object.keys(typingUsers).length > 0 && (
            <div className="px-4 pt-1.5 text-xs italic text-[var(--text-secondary)] flex items-center gap-2">
              <span className="flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '120ms' }} />
                <span className="w-1 h-1 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '240ms' }} />
              </span>
              <span>{Object.values(typingUsers).map(u => u.name).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing…</span>
            </div>
          )}

          {/* Input */}
          <form onSubmit={handleSend} className="px-4 py-3 border-t border-[var(--border)] flex gap-2 items-end relative">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handlePickFile} />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
              title={t('chat.attach')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>

            <button
              type="button"
              onClick={() => setEmojiOpen((v) => !v)}
              className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
              title={t('chat.emoji')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                <line x1="9" y1="9" x2="9.01" y2="9"/>
                <line x1="15" y1="9" x2="15.01" y2="9"/>
              </svg>
            </button>

            <VoiceRecorder onSend={handleVoiceSend} disabled={uploading} />

            <EmojiPicker open={emojiOpen} onClose={() => setEmojiOpen(false)} onPick={insertEmoji} />

            {/* Mention autocomplete */}
            {mentionState && mentionCandidates.length > 0 && (
              <div className="absolute bottom-14 left-24 z-30 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl w-64 overflow-hidden">
                {mentionCandidates.map((u, i) => (
                  <button
                    key={u.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); pickMention(u) }}
                    onMouseEnter={() => setMentionIdx(i)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm ${
                      i === mentionIdx ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center text-xs font-bold shrink-0">
                      {(u.full_name || u.email)[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[var(--text)] truncate">{u.full_name || u.email}</div>
                      <div className="text-[10px] text-[var(--text-secondary)] truncate">@{(u.email || '').split('@')[0]}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                updateMentionState(e.target.value, e.target.selectionStart ?? e.target.value.length)
                if (e.target.value) emitTyping()
              }}
              onKeyDown={(e) => {
                if (mentionState && mentionCandidates.length > 0) {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx((i) => (i + 1) % mentionCandidates.length); return }
                  if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx((i) => (i - 1 + mentionCandidates.length) % mentionCandidates.length); return }
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault()
                    pickMention(mentionCandidates[mentionIdx])
                    return
                  }
                  if (e.key === 'Escape') { setMentionState(null); return }
                }
              }}
              onSelect={(e) => {
                const t = e.currentTarget
                updateMentionState(t.value, t.selectionStart ?? t.value.length)
              }}
              placeholder={t('chat.writePlaceholder')}
              className="flex-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-4 py-2.5 focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
            />
            <button
              type="submit"
              disabled={(!input.trim() && !pendingFile) || uploading}
              className="bg-[var(--accent)] text-white rounded-full w-10 h-10 flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity shrink-0"
            >
              {uploading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* Empty state */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-5xl mb-3 opacity-30">💬</div>
            <div className="text-sm text-[var(--text-secondary)] mb-4">{t('chat.pickChannelToStart')}</div>
            <button
              onClick={() => setShowNewChat(true)}
              className="px-4 py-2 rounded-[var(--radius-lg)] bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {t('chat.newChatBtn')}
            </button>
          </div>
        </div>
      )}

      {/* ── Context menu — Telegram-style: backdrop + reaction bar above the bubble + actions below ── */}
      {ctxMenu && (() => {
        const own = ctxMenu.msg.author?.id === user?.id
        const items: { icon: string; label: string; action: () => void; danger?: boolean }[] = [
          { icon: '↩', label: t('chat.reply'), action: ctxReply },
          { icon: '⤴', label: t('chat.forward'), action: ctxForward },
          { icon: '📌', label: pinnedIds.has(ctxMenu.msg.id) ? t('chat.unpin') : t('chat.pin'), action: ctxPin },
          { icon: '📋', label: t('chat.copy'), action: ctxCopy },
        ]
        if (own) {
          items.push({ icon: '✏', label: 'Edit', action: ctxEdit })
          items.push({ icon: '🗑', label: 'Delete', action: ctxDelete, danger: true })
        }

        // Layout — picker above, actions below the bubble
        const PICKER_H = 44
        const ACTION_H = items.length * 42 + 8
        const MARGIN = 8
        const vh = window.innerHeight
        // Try to render below; if no room — flip above
        let actionTop = ctxMenu.rect.bottom + MARGIN
        if (actionTop + ACTION_H > vh - 16) {
          actionTop = Math.max(16, ctxMenu.rect.top - ACTION_H - MARGIN)
        }
        let pickerTop = ctxMenu.rect.top - PICKER_H - MARGIN
        if (pickerTop < 16) pickerTop = ctxMenu.rect.bottom + MARGIN

        // Horizontal: picker + menu align to the message edge (own → right edge, others → left edge)
        const PICKER_W = 7 * 36 + 16
        const ACTION_W = 220
        const pickerLeft = own
          ? Math.max(8, Math.min(ctxMenu.rect.right - PICKER_W, window.innerWidth - PICKER_W - 8))
          : Math.max(8, Math.min(ctxMenu.rect.left, window.innerWidth - PICKER_W - 8))
        const actionLeft = own
          ? Math.max(8, Math.min(ctxMenu.rect.right - ACTION_W, window.innerWidth - ACTION_W - 8))
          : Math.max(8, Math.min(ctxMenu.rect.left, window.innerWidth - ACTION_W - 8))

        return (
          <>
            {/* Backdrop — closes the menu, dims the rest */}
            <div
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
              onClick={() => setCtxMenu(null)}
              onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null) }}
            />

            {/* Reaction bar */}
            <div
              ref={ctxRef}
              className="fixed z-50 flex items-center gap-1 px-2 py-1.5 rounded-full bg-[var(--bg-card-solid,var(--bg-card))] border border-[var(--border)] shadow-[0_8px_32px_rgba(0,0,0,0.32)]"
              style={{ top: pickerTop, left: pickerLeft }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => ctxReact(emoji)}
                  className="text-xl leading-none w-8 h-8 flex items-center justify-center hover:scale-125 active:scale-95 transition-transform"
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Action menu */}
            <div
              className="fixed z-50 bg-[var(--bg-card-solid,var(--bg-card))] border border-[var(--border)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.32)] py-1 overflow-hidden"
              style={{ top: actionTop, left: actionLeft, width: ACTION_W }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {items.map(({ icon, label, action, danger }) => (
                <button
                  key={label}
                  onClick={action}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[var(--bg-hover)] transition-colors text-left ${danger ? 'text-[var(--danger,#FF6B6B)]' : 'text-[var(--text)]'}`}
                >
                  <span className="text-base w-5 text-center">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </>
        )
      })()}

      {/* ── Inline reaction quick-pick ── */}
      {reactPickerFor && (
        <div
          ref={reactPickerRef}
          role="menu"
          aria-label="Reaction picker"
          className="fixed z-50 flex gap-1 px-2 py-1.5 rounded-full bg-[var(--bg-card-solid,var(--bg-card))] border border-[var(--border)] shadow-lg"
          style={{ left: reactPickerFor.x, top: reactPickerFor.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => reactPickerSend(emoji)}
              className="text-lg leading-none w-7 h-7 flex items-center justify-center hover:scale-125 active:scale-95 transition-transform"
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* ── Members modal ── */}
      {activeChannel && (
        <MembersModal
          channel={activeChannel}
          open={membersOpen}
          onClose={() => setMembersOpen(false)}
          onChanged={loadChannels}
        />
      )}

      {/* ── Media gallery modal ── */}
      {activeChannelId && (
        <MediaGalleryModal
          channelId={activeChannelId}
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
        />
      )}

      {/* ── Image lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white hover:bg-black/70 flex items-center justify-center transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* ── Forward modal ── */}
      {forwardMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setForwardMsg(null)}>
          <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-[var(--radius-xl)] p-5 w-80 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-[var(--text)] mb-3">{t('chat.forwardTitle')}</h3>
            <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] rounded-xl p-2 mb-4 line-clamp-3">{forwardMsg.text}</div>
            <p className="text-xs text-[var(--text-secondary)] mb-2">{t('chat.pickChannel')}</p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handleForward(ch.id)}
                  className="w-full text-left text-sm px-3 py-2 rounded-xl hover:bg-[var(--bg-hover)] text-[var(--text)] transition-colors flex items-center gap-2"
                >
                  <div className="w-7 h-7 rounded-full bg-[var(--accent)]/15 flex items-center justify-center text-xs font-semibold text-[var(--accent)]">
                    {getChannelInitial(ch)}
                  </div>
                  <span>{getChannelName(ch)}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setForwardMsg(null)} className="mt-3 text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] w-full text-center">{t('common.cancel')}</button>
          </div>
        </div>
      )}

      {/* ── New Chat modal ── */}
      {showNewChat && (
        <NewChatModal
          members={workspaceMembers}
          currentUserId={user?.id}
          onSelect={handleStartDM}
          onClose={() => setShowNewChat(false)}
        />
      )}

      {/* ── New Group modal ── */}
      {showNewGroup && (
        <NewGroupModal
          members={workspaceMembers}
          currentUserId={user?.id}
          onSubmit={handleCreateGroup}
          onClose={() => setShowNewGroup(false)}
          creating={creatingGroup}
        />
      )}
    </div>
  )
}
