import { useState } from 'react'
import { aiApi, type NextBestActionResult } from '../../api/ai'

const IMPACT_COLORS: Record<string, string> = {
  high: 'bg-red-500/15 text-red-500 border-red-500/30',
  medium: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  low: 'bg-[var(--bg-hover)] text-[var(--text-secondary)] border-[var(--border)]',
}

export default function NextBestActionWidget() {
  const [result, setResult] = useState<NextBestActionResult | null>(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    setLoading(true)
    try {
      const r = await aiApi.nextBestAction()
      setResult(r)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-[var(--bg-card)] rounded-lg p-6 border border-[var(--border)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/></svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wide">AI · что делать сейчас</h2>
            <p className="text-xs text-[var(--text-secondary)]">Топ действий для вашего пайплайна</p>
          </div>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="px-3 py-1.5 text-sm text-white bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? 'Думаю...' : result ? 'Обновить' : 'Получить рекомендации'}
        </button>
      </div>

      {result?.pipeline && (
        <div className="flex items-center gap-4 mb-4 text-xs text-[var(--text-secondary)]">
          <span>Открытых сделок: <b className="text-[var(--text)]">{result.pipeline.open_deals}</b></span>
          <span>Открытых задач: <b className="text-[var(--text)]">{result.pipeline.open_tasks}</b></span>
          {result.pipeline.overdue_tasks > 0 && (
            <span className="text-red-500">⚠ просрочено: <b>{result.pipeline.overdue_tasks}</b></span>
          )}
        </div>
      )}

      {result === null && !loading && (
        <p className="text-sm text-[var(--text-secondary)]">Нажмите кнопку, чтобы получить AI-рекомендации на сегодня — какая сделка в зоне риска, где нужно сделать следующий шаг, что просрочено.</p>
      )}

      {result && result.actions && result.actions.length > 0 && (
        <ol className="space-y-2">
          {result.actions.map((a, i) => (
            <li key={i} className={`rounded-lg border p-3 ${IMPACT_COLORS[a.impact ?? 'low']}`}>
              <div className="flex items-start gap-3">
                <span className="text-xs font-bold opacity-70 w-5">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text)]">{a.title}</div>
                  {a.rationale && <div className="text-xs text-[var(--text-secondary)] mt-0.5">{a.rationale}</div>}
                </div>
                {a.impact && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider opacity-70 shrink-0">{a.impact}</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {result && (!result.actions || result.actions.length === 0) && (
        <div className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] rounded-lg p-3">
          <p className="mb-1 font-medium">AI не смог разобрать ответ. Raw:</p>
          <pre className="whitespace-pre-wrap break-words text-[10px]">{result.raw?.slice(0, 500) ?? 'no raw'}</pre>
        </div>
      )}
    </div>
  )
}
