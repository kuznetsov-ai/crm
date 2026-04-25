import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { aiApi, type ResourceMatchResult } from '../../api/ai'

export default function ResourceMatchModal({
  dealId, open, onClose,
}: { dealId: number; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const [result, setResult] = useState<ResourceMatchResult | null>(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true); setResult(null)
    try { setResult(await aiApi.resourceMatch(dealId)) }
    finally { setLoading(false) }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-xl bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Подбор команды (AI)</h3>
            <p className="text-xs text-[var(--text-secondary)]">LLM выбирает топ-5 консультантов под требования сделки</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: 'auto' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          {!result && (
            <div className="flex flex-col items-center gap-2 py-6">
              <p className="text-sm text-[var(--text-secondary)] text-center">Нажмите кнопку, чтобы подобрать консультантов с bench по скиллам сделки.</p>
              <button onClick={run} disabled={loading} className="px-4 py-2 text-sm text-white bg-[var(--accent)] rounded-lg hover:opacity-90 disabled:opacity-50">
                {loading ? 'Подбираем...' : 'Подобрать команду'}
              </button>
            </div>
          )}
          {result?.picks && result.picks.length > 0 && (
            <div className="space-y-2">
              {result.picks.map((p, i) => (
                <div key={i} className="rounded-lg border border-[var(--border)] p-3 bg-[var(--bg-hover)]">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-[var(--text)]">{p.name}</div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] font-semibold uppercase tracking-wider">{p.role}</span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">{p.match_reason}</p>
                  {p.skill_overlap?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {p.skill_overlap.map((s, j) => (
                        <span key={j} className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-500">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button onClick={run} disabled={loading} className="text-xs text-[var(--accent)] hover:underline w-full text-center pt-2">{t('ai.regenerate')}</button>
            </div>
          )}
          {result && (!result.picks || result.picks.length === 0) && result.raw && (
            <pre className="text-[10px] whitespace-pre-wrap break-words bg-[var(--bg-hover)] p-2 rounded">{result.raw.slice(0, 400)}</pre>
          )}
        </div>
      </div>
    </div>
  )
}
