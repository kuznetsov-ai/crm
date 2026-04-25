import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePipelinesStore } from '../../stores/usePipelinesStore'

export default function PipelineSwitcher() {
  const { t } = useTranslation()
  const { pipelines, currentId, fetch, setCurrent } = usePipelinesStore()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (pipelines.length === 0) fetch('deal')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const current = pipelines.find(p => p.id === currentId) ?? pipelines[0]
  if (!current) return null

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--border)] hover:bg-[var(--bg-hover)] text-sm cursor-pointer"
        aria-label={t('pipeline.switcher_label')}
      >
        <span className="text-[var(--text-secondary)]">{t('pipeline.label')}:</span>
        <span className="font-medium">{current.name}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && pipelines.length > 1 && (
        <div className="absolute left-0 mt-1 w-56 bg-[var(--bg-card)] border border-[var(--border)] rounded-md shadow-lg z-50">
          {pipelines.map((p) => (
            <button
              key={p.id}
              onClick={() => { setCurrent(p.id); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-hover)] cursor-pointer ${p.id === currentId ? 'font-semibold' : ''}`}
            >
              {p.name}
              {p.is_default ? <span className="ml-2 text-xs text-[var(--text-secondary)]">(default)</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
