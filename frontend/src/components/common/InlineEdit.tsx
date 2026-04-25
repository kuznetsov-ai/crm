import { useEffect, useRef, useState } from 'react'

type InputKind = 'text' | 'textarea' | 'select' | 'number'

interface Props {
  value: string
  onSave: (next: string) => Promise<void> | void
  kind?: InputKind
  options?: { value: string; label: string }[]
  placeholder?: string
  className?: string
  emptyLabel?: string
  multiline?: boolean
  readOnly?: boolean
}

export default function InlineEdit({
  value,
  onSave,
  kind = 'text',
  options,
  placeholder,
  className = '',
  emptyLabel = '—',
  readOnly,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null)

  useEffect(() => { setDraft(value) }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if ('select' in inputRef.current && kind !== 'select') {
        try { (inputRef.current as HTMLInputElement).select() } catch { /* ignore */ }
      }
    }
  }, [editing, kind])

  const commit = async () => {
    if (draft === value) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } catch {
      setDraft(value)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && kind !== 'textarea') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      cancel()
    }
  }

  if (readOnly) {
    return <span className={className}>{value || emptyLabel}</span>
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`text-left hover:bg-[var(--bg-hover)] rounded px-1 -mx-1 transition-colors cursor-text ${className}`}
        title="Нажмите, чтобы отредактировать"
      >
        {value ? (
          kind === 'select' && options ? options.find((o) => o.value === value)?.label ?? value : value
        ) : (
          <span className="text-[var(--text-secondary)]">{emptyLabel}</span>
        )}
      </button>
    )
  }

  const baseCls = 'w-full rounded border border-[var(--accent)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-2 py-1 focus:outline-none'

  if (kind === 'select' && options) {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setTimeout(() => commit(), 0) }}
        onBlur={commit}
        className={baseCls}
        disabled={saving}
      >
        <option value="">—</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  }

  if (kind === 'textarea') {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        placeholder={placeholder}
        disabled={saving}
        rows={3}
        className={`${baseCls} resize-y`}
      />
    )
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={kind === 'number' ? 'number' : 'text'}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={commit}
      placeholder={placeholder}
      disabled={saving}
      className={baseCls}
    />
  )
}
