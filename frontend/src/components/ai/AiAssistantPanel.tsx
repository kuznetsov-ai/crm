import { useState } from 'react'
import { aiApi, type EmailPreset } from '../../api/ai'

interface Props {
  dealId: number
  open: boolean
  onClose: () => void
}

type Mode = 'menu' | 'summary' | 'draft'

const PRESETS: { key: EmailPreset; label: string; icon: string }[] = [
  { key: 'follow_up', label: 'Follow-up после разговора', icon: '💬' },
  { key: 'reminder', label: 'Напоминание о решении', icon: '⏰' },
  { key: 'proposal_intro', label: 'Сопровождение proposal', icon: '📄' },
  { key: 'meeting_request', label: 'Предложить встречу', icon: '📅' },
]

export default function AiAssistantPanel({ dealId, open, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('menu')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')
  const [activePreset, setActivePreset] = useState<EmailPreset | null>(null)

  const runSummary = async () => {
    setMode('summary')
    setLoading(true)
    setResult('')
    try {
      const r = await aiApi.dealSummary(dealId)
      setResult(r.summary)
    } catch (err) {
      setResult(`Ошибка: ${(err as Error).message || 'unknown'}`)
    } finally {
      setLoading(false)
    }
  }

  const runDraft = async (preset: EmailPreset) => {
    setMode('draft')
    setActivePreset(preset)
    setLoading(true)
    setResult('')
    try {
      const r = await aiApi.draftEmail(dealId, preset)
      setResult(r.draft)
    } catch (err) {
      setResult(`Ошибка: ${(err as Error).message || 'unknown'}`)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result).catch(() => {})
  }

  const reset = () => {
    setMode('menu')
    setResult('')
    setActivePreset(null)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[55] flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 pt-[10vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--text)]">AI ассистент</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              {mode === 'menu' && 'Выберите действие'}
              {mode === 'summary' && 'Краткое резюме сделки'}
              {mode === 'draft' && activePreset && PRESETS.find((p) => p.key === activePreset)?.label}
            </p>
          </div>
          {mode !== 'menu' && (
            <button onClick={reset} className="text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">← Назад</button>
          )}
          <button onClick={onClose} className="w-7 h-7 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: 'auto' }}>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto max-h-[70vh]">
          {mode === 'menu' && (
            <div className="space-y-3">
              <button
                onClick={runSummary}
                className="w-full text-left p-4 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📊</span>
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">Резюме сделки</div>
                    <div className="text-xs text-[var(--text-secondary)]">Где мы, next step, риски — на основе заметок и задач</div>
                  </div>
                </div>
              </button>

              <div className="pt-2">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2 px-1">Авто-draft письма</div>
                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => runDraft(p.key)}
                      className="text-left p-3 rounded-xl border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{p.icon}</span>
                        <span className="text-xs font-medium text-[var(--text)]">{p.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(mode === 'summary' || mode === 'draft') && (
            <div>
              {loading && (
                <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                  <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  Генерирую...
                </div>
              )}
              {!loading && result && (
                <>
                  <pre className="whitespace-pre-wrap break-words text-sm text-[var(--text)] font-sans bg-[var(--bg-hover)] rounded-xl p-4 border border-[var(--border)]">{result}</pre>
                  <div className="mt-3 flex gap-2 justify-end">
                    <button
                      onClick={copyToClipboard}
                      className="px-3 py-1.5 text-xs border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      📋 Копировать
                    </button>
                    {mode === 'summary' && (
                      <button onClick={runSummary} className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity">
                        Перегенерировать
                      </button>
                    )}
                    {mode === 'draft' && activePreset && (
                      <button onClick={() => runDraft(activePreset)} className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity">
                        Перегенерировать
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
