import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { aiApi, type CandidateMatchResult } from '../../api/ai'

export default function CandidateMatchModal({
  clientId, open, onClose,
}: { clientId: number; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const [result, setResult] = useState<CandidateMatchResult | null>(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true); setResult(null)
    try { setResult(await aiApi.candidateMatch(clientId)) }
    finally { setLoading(false) }
  }

  const copy = (text: string) => navigator.clipboard.writeText(text).catch(() => {})

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Идеальный кандидат (AI)</h3>
            <p className="text-xs text-[var(--text-secondary)]">Профиль для рекрутера — можно вставить в hh.ru / LinkedIn</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: 'auto' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          {!result && (
            <div className="flex flex-col items-center gap-2 py-6">
              <button onClick={run} disabled={loading} className="px-4 py-2 text-sm text-white bg-[var(--accent)] rounded-lg hover:opacity-90 disabled:opacity-50">
                {loading ? 'Генерируем...' : 'Сгенерировать профиль'}
              </button>
            </div>
          )}
          {result && (result.role || result.sourcing_brief) && (
            <div className="space-y-2 text-sm">
              {result.role && <div><b>Роль:</b> {result.role}</div>}
              {result.seniority && <div><b>Уровень:</b> {result.seniority}</div>}
              {result.required_skills && result.required_skills.length > 0 && (
                <div className="flex flex-wrap gap-1"><b className="mr-1">Требуется:</b>
                  {result.required_skills.map((s, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-500">{s}</span>
                  ))}
                </div>
              )}
              {result.nice_to_have && result.nice_to_have.length > 0 && (
                <div className="flex flex-wrap gap-1"><b className="mr-1">Плюс:</b>
                  {result.nice_to_have.map((s, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-secondary)]">{s}</span>
                  ))}
                </div>
              )}
              {result.culture_fit && <div className="text-xs text-[var(--text-secondary)]"><b>Культура:</b> {result.culture_fit}</div>}
              {result.sourcing_brief && (
                <div className="bg-[var(--accent)]/10 border border-[var(--accent)]/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <b className="text-xs">Sourcing brief</b>
                    <button onClick={() => copy(result.sourcing_brief!)} className="text-[10px] text-[var(--accent)] hover:underline">📋 copy</button>
                  </div>
                  <p className="text-xs whitespace-pre-wrap">{result.sourcing_brief}</p>
                </div>
              )}
              <button onClick={run} disabled={loading} className="text-xs text-[var(--accent)] hover:underline w-full text-center pt-2">{t('ai.regenerate')}</button>
            </div>
          )}
          {result?.raw && (
            <pre className="text-[10px] whitespace-pre-wrap break-words bg-[var(--bg-hover)] p-2 rounded">{result.raw.slice(0, 400)}</pre>
          )}
        </div>
      </div>
    </div>
  )
}
