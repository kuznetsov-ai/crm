import { useEffect, useState } from 'react'
import { aiApi, type BenchRosterResult } from '../api/ai'

export default function BenchPage() {
  const [data, setData] = useState<BenchRosterResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    aiApi.bench().then(setData).finally(() => setLoading(false))
  }, [])

  const roster = data?.roster ?? []
  const totals = data?.totals

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text)]">Bench / Utilization</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Кто свободен, кто на проекте, ближайшие rolloff. Данные пока демо — подключение HR-системы отдельным эпиком.
          </p>
        </div>
        {totals && (
          <div className="flex gap-2">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2">
              <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Всего</div>
              <div className="text-lg font-bold text-[var(--text)]">{totals.count}</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2">
              <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">На bench</div>
              <div className="text-lg font-bold text-orange-500">{totals.bench_count}</div>
            </div>
            <div className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/5 px-3 py-2">
              <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Средний util</div>
              <div className="text-lg font-bold text-[var(--accent)]">{totals.avg_utilization_pct}%</div>
            </div>
          </div>
        )}
      </header>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg-card)]">
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--text-secondary)]">Загрузка...</div>
        ) : roster.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-secondary)]">Нет данных</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-hover)]">
              <tr>
                {['Консультант', 'Роль', 'Загрузка', 'Скиллы', 'Текущий клиент', 'Rolloff'].map((h) => (
                  <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {roster.map((r) => {
                const utilColor = r.utilization_pct < 30 ? 'bg-orange-500' : r.utilization_pct < 70 ? 'bg-blue-500' : 'bg-green-500'
                return (
                  <tr key={r.user_id}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-[var(--text)]">{r.name}</div>
                      <div className="text-[11px] text-[var(--text-secondary)]">{r.email}</div>
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{r.role}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden">
                          <div className={`h-full ${utilColor}`} style={{ width: `${r.utilization_pct}%` }} />
                        </div>
                        <span className="text-[var(--text)] text-xs tabular-nums">{r.utilization_pct}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {r.skills.slice(0, 4).map((s, i) => (
                          <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-secondary)]">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{r.current_client ?? <span className="text-orange-500">— bench</span>}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{r.rolloff_date ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
