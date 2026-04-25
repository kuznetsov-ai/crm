import { useEffect, useRef, useState } from 'react'

const CATEGORIES: { key: string; label: string; emojis: string[] }[] = [
  {
    key: 'smileys', label: '😀',
    emojis: ['😀','😃','😄','😁','😅','😂','🤣','🥲','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕'],
  },
  {
    key: 'gestures', label: '👍',
    emojis: ['👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','✋','🤚','🖐','🖖','👋','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁','👅','👄','💋'],
  },
  {
    key: 'hearts', label: '❤️',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️'],
  },
  {
    key: 'objects', label: '🎉',
    emojis: ['🎉','🎊','🔥','💯','⚡','⭐','✨','💫','🌟','✅','❌','⚠️','📌','📎','💬','💭','🎯','🏆','🎁','🎂','🍾','🍷','🍺','☕','🍕','🍔','🍟','🍣','🍱','🍰','🎂','🚀','✈️','🚗','🏠','📱','💻','⌨️','🖥','💾','📷','📹','🎥','🎬','🎤','🎧','🎸','🎹','🎮'],
  },
]

interface Props {
  open: boolean
  onClose: () => void
  onPick: (emoji: string) => void
}

export default function EmojiPicker({ open, onClose, onPick }: Props) {
  const [cat, setCat] = useState(CATEGORIES[0].key)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  if (!open) return null

  const active = CATEGORIES.find((c) => c.key === cat) ?? CATEGORIES[0]

  return (
    <div
      ref={panelRef}
      className="absolute bottom-14 left-2 z-30 w-80 max-w-[90vw] bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden flex flex-col"
      style={{ maxHeight: '320px' }}
    >
      {/* Tabs */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-[var(--border)]">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCat(c.key)}
            className={`text-lg w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              cat === c.key ? 'bg-[var(--accent)]/15' : 'hover:bg-[var(--bg-hover)]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-8 gap-1">
        {active.emojis.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            className="text-xl w-9 h-9 rounded-lg hover:bg-[var(--bg-hover)] active:scale-90 transition-transform"
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}
