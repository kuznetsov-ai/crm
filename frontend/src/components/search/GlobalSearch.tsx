import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'

type ResultKind = 'client' | 'deal' | 'task'

interface SearchResult {
  kind: ResultKind
  id: number
  title: string
  subtitle?: string
  url: string
}

interface RawClient { id: number; name: string; industry?: string; status?: string }
interface RawDeal { id: number; title: string; client?: { name: string } | null; status?: string }
interface RawTask { id: number; title: string; description?: string; priority?: string; status?: string }

function paged<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object' && 'results' in data) {
    return ((data as { results: T[] }).results) ?? []
  }
  return []
}

export default function GlobalSearch() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Global hotkey
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape' && open) setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 20)
      setActiveIdx(0)
    } else {
      setQuery('')
      setResults([])
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const [cRes, dRes, tRes] = await Promise.allSettled([
          api.get('/clients/', { params: { search: q, page_size: 5 } }),
          api.get('/deals/', { params: { search: q, page_size: 5 } }),
          api.get('/tasks/', { params: { search: q, page_size: 5 } }),
        ])
        if (cancelled) return

        const out: SearchResult[] = []

        if (cRes.status === 'fulfilled') {
          paged<RawClient>(cRes.value.data).forEach((c) => {
            out.push({
              kind: 'client',
              id: c.id,
              title: c.name,
              subtitle: c.industry || c.status,
              url: `/clients/${c.id}`,
            })
          })
        }
        if (dRes.status === 'fulfilled') {
          paged<RawDeal>(dRes.value.data).forEach((d) => {
            out.push({
              kind: 'deal',
              id: d.id,
              title: d.title,
              subtitle: d.client?.name ?? d.status,
              url: `/deals/${d.id}`,
            })
          })
        }
        if (tRes.status === 'fulfilled') {
          paged<RawTask>(tRes.value.data).forEach((tk) => {
            out.push({
              kind: 'task',
              id: tk.id,
              title: tk.title,
              subtitle: tk.priority ?? tk.status,
              url: `/tasks`,
            })
          })
        }

        setResults(out)
        setActiveIdx(0)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, open])

  const pickResult = useCallback(
    (r: SearchResult) => {
      setOpen(false)
      navigate(r.url)
    },
    [navigate],
  )

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(results.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' && results[activeIdx]) {
      e.preventDefault()
      pickResult(results[activeIdx])
    }
  }

  const grouped = useMemo(() => {
    const map: Record<ResultKind, SearchResult[]> = { client: [], deal: [], task: [] }
    results.forEach((r) => map[r.kind].push(r))
    return map
  }, [results])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--text-secondary)] shrink-0">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent text-[var(--text)] text-sm outline-none placeholder:text-[var(--text-secondary)]"
          />
          <kbd className="text-[10px] px-1.5 py-0.5 border border-[var(--border)] rounded text-[var(--text-secondary)]">Esc</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {!query.trim() ? (
            <div className="p-6 text-center text-xs text-[var(--text-secondary)]">
              {t('search.hint')}
            </div>
          ) : loading && results.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-secondary)]">{t('common.loading')}</div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--text-secondary)]">{t('search.noResults')}</div>
          ) : (
            <ResultGroups grouped={grouped} activeIdx={activeIdx} results={results} onPick={pickResult} />
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-[var(--border)] flex items-center gap-3 text-[10px] text-[var(--text-secondary)]">
          <span><kbd className="px-1 border border-[var(--border)] rounded">↑↓</kbd> {t('search.navigate')}</span>
          <span><kbd className="px-1 border border-[var(--border)] rounded">↵</kbd> {t('search.open')}</span>
          <span className="ml-auto"><kbd className="px-1 border border-[var(--border)] rounded">⌘K</kbd></span>
        </div>
      </div>
    </div>
  )
}

function ResultGroups({
  grouped,
  activeIdx,
  results,
  onPick,
}: {
  grouped: Record<ResultKind, SearchResult[]>
  activeIdx: number
  results: SearchResult[]
  onPick: (r: SearchResult) => void
}) {
  const { t } = useTranslation()
  const order: { kind: ResultKind; label: string }[] = [
    { kind: 'client', label: t('nav.clients') },
    { kind: 'deal', label: t('nav.deals') },
    { kind: 'task', label: t('nav.tasks') },
  ]

  return (
    <div>
      {order.map(({ kind, label }) => {
        const items = grouped[kind]
        if (items.length === 0) return null
        return (
          <div key={kind} className="py-1">
            <div className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">{label}</div>
            {items.map((r) => {
              const globalIdx = results.indexOf(r)
              const active = globalIdx === activeIdx
              return (
                <button
                  key={`${r.kind}-${r.id}`}
                  type="button"
                  onClick={() => onPick(r)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                    active ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <ResultIcon kind={r.kind} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--text)] truncate">{r.title}</div>
                    {r.subtitle && <div className="text-xs text-[var(--text-secondary)] truncate">{r.subtitle}</div>}
                  </div>
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function ResultIcon({ kind }: { kind: ResultKind }) {
  if (kind === 'client') {
    return (
      <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/>
        </svg>
      </div>
    )
  }
  if (kind === 'deal') {
    return (
      <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
      </div>
    )
  }
  return (
    <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    </div>
  )
}
