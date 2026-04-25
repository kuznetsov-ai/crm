import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { aiApi, type TranscriptResult } from '../../api/ai'

export default function TranscriptModal({
  clientId, dealId, open, onClose, onSaved,
}: { clientId?: number; dealId?: number; open: boolean; onClose: () => void; onSaved?: () => void }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [result, setResult] = useState<TranscriptResult | null>(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    if (!text.trim()) return
    setLoading(true); setResult(null)
    try {
      const r = await aiApi.transcript(text, clientId, dealId)
      setResult(r)
      if (r.saved_note_id && onSaved) onSaved()
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const inputCls = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)]'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">{t('ai.transcript')}</h3>
            <p className="text-xs text-[var(--text-secondary)]">{t('ai.paste')}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: 'auto' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          {!result && (
            <>
              <textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} className={`${inputCls} resize-y font-mono text-xs`} placeholder="Paste meeting transcript here..." />
              <div className="flex justify-end">
                <button onClick={run} disabled={loading || !text.trim()} className="px-4 py-2 text-sm text-white bg-[var(--accent)] rounded-lg hover:opacity-90 disabled:opacity-50">
                  {loading ? t('ai.processing') : t('ai.process')}
                </button>
              </div>
            </>
          )}
          {result && (
            <div className="space-y-3 text-sm">
              {result.summary && (
                <div>
                  <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Summary</div>
                  <p className="whitespace-pre-wrap text-[var(--text)]">{result.summary}</p>
                </div>
              )}
              {result.decisions && result.decisions.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('ai.decisions')}</div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {result.decisions.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
              )}
              {result.action_items && result.action_items.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('ai.actionItems')}</div>
                  <ul className="space-y-1">
                    {result.action_items.map((a, i) => (
                      <li key={i} className="rounded-lg bg-[var(--bg-hover)] p-2 text-xs">
                        <div className="font-medium text-[var(--text)]">{a.title}</div>
                        {(a.owner || a.deadline) && (
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            {a.owner && <>→ {a.owner}</>}
                            {a.deadline && <> · до {a.deadline}</>}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.open_questions && result.open_questions.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1">{t('ai.openQuestions')}</div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[var(--text-secondary)]">
                    {result.open_questions.map((q, i) => <li key={i}>{q}</li>)}
                  </ul>
                </div>
              )}
              {result.saved_note_id && (
                <div className="text-xs text-green-500 bg-green-500/10 border border-green-500/30 rounded-lg p-2">
                  ✓ Сохранено в базе знаний клиента (note #{result.saved_note_id})
                </div>
              )}
              {result.raw && (
                <pre className="text-[10px] whitespace-pre-wrap break-words bg-[var(--bg-hover)] p-2 rounded">{result.raw.slice(0, 300)}</pre>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => { setResult(null); setText('') }} className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">{t('ai.newTranscript')}</button>
                <button onClick={onClose} className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90">{t('ai.done')}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
