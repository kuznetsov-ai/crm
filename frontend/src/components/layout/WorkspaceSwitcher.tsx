import { useEffect, useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'

export default function WorkspaceSwitcher() {
  const { t } = useTranslation()
  const { workspaces, currentSlug, fetchMe, switchTo } = useWorkspaceStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (workspaces.length === 0) fetchMe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (workspaces.length <= 1) return null

  const current = workspaces.find(w => w.slug === currentSlug) ?? workspaces[0]

  async function onSelect(slug: string) {
    if (slug === currentSlug) { setOpen(false); return }
    await switchTo(slug)
    setOpen(false)
    // Hard reload to flush every store with data from another tenant.
    window.location.reload()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors text-sm cursor-pointer"
        aria-label={t('workspace.switcher_label')}
      >
        <span className="font-medium text-[var(--text)]">{current.name}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-56 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-lg z-50">
          {workspaces.map(w => (
            <button
              key={w.slug}
              onClick={() => onSelect(w.slug)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-hover)] transition-colors cursor-pointer first:rounded-t-lg last:rounded-b-lg ${
                w.slug === currentSlug ? 'font-semibold text-[var(--accent)]' : 'text-[var(--text)]'
              }`}
            >
              {w.name}
              {w.role && <div className="text-xs text-[var(--text-secondary)]">{w.role}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
