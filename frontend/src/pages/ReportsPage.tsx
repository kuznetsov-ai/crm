import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import api from '../api/client'

type Entity = 'deals' | 'clients' | 'tasks'
type GroupBy = 'status' | 'month' | 'manager' | 'industry' | 'priority'

interface ReportRow {
  [key: string]: string | number | null | undefined
}

interface ReportResponse {
  entity: Entity
  group_by: GroupBy
  data: ReportRow[]
  total: number
}

const COLORS = [
  '#fd7448',
  '#60a5fa',
  '#34d399',
  '#f59e0b',
  '#a78bfa',
  '#f87171',
  '#94a3b8',
  '#fb923c',
]

const GROUP_BY_OPTIONS: Record<Entity, { value: GroupBy; label: string }[]> = {
  deals: [
    { value: 'status', label: 'По статусу' },
    { value: 'month', label: 'По месяцу' },
    { value: 'manager', label: 'По менеджеру' },
  ],
  clients: [
    { value: 'status', label: 'По статусу' },
    { value: 'month', label: 'По месяцу' },
    { value: 'industry', label: 'По отрасли' },
  ],
  tasks: [
    { value: 'status', label: 'По статусу' },
    { value: 'priority', label: 'По приоритету' },
    { value: 'month', label: 'По месяцу' },
  ],
}

function getRowLabel(row: ReportRow, groupBy: GroupBy): string {
  if (groupBy === 'manager') {
    const first = row['assigned_to__first_name'] ?? ''
    const last = row['assigned_to__last_name'] ?? ''
    const email = row['assigned_to__email'] ?? ''
    const name = `${first} ${last}`.trim()
    return name || String(email) || 'Не назначен'
  }
  return String(
    row['label'] ?? row['status'] ?? row['industry'] ?? row['priority'] ?? '-'
  )
}

function formatValue(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'number') return val.toLocaleString()
  return String(val)
}

export default function ReportsPage() {
  const { t } = useTranslation()
  const [entity, setEntity] = useState<Entity>('deals')
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reportData, setReportData] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetched, setFetched] = useState(false)

  // When entity changes, reset groupBy to first valid option
  const handleEntityChange = (e: Entity) => {
    setEntity(e)
    setGroupBy(GROUP_BY_OPTIONS[e][0].value)
    setReportData([])
    setFetched(false)
  }

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ entity, group_by: groupBy })
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      const res = await api.get<ReportResponse>(
        `/dashboard/reports/?${params.toString()}`
      )
      setReportData(res.data.data)
      setFetched(true)
    } catch (e) {
      setError('Не удалось загрузить данные отчёта')
    } finally {
      setLoading(false)
    }
  }, [entity, groupBy, dateFrom, dateTo])

  // Auto-fetch on mount and when filters change after initial fetch
  useEffect(() => {
    fetchReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, groupBy])

  const [exporting, setExporting] = useState(false)

  const exportCSV = async () => {
    setExporting(true)
    setError(null)
    try {
      const params = new URLSearchParams({ entity })
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)
      const res = await api.get(`/dashboard/reports/export/?${params.toString()}`, {
        responseType: 'blob',
      })
      const blob = res.data
      const dispo = res.headers['content-disposition'] as string | undefined
      let filename = `crm_export_${entity}.csv`
      const m = dispo?.match(/filename="?([^";]+)"?/i)
      if (m?.[1]) filename = m[1]
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Не удалось экспортировать CSV')
    } finally {
      setExporting(false)
    }
  }

  const chartData = reportData.map((row) => ({
    label: getRowLabel(row, groupBy),
    count: Number(row.count ?? 0),
    total_value: row.total_value !== undefined ? Number(row.total_value) : undefined,
  }))

  const maxCount = Math.max(...chartData.map((d) => d.count), 1)

  const tableColumns = reportData.length
    ? Object.keys(reportData[0]).filter(
        (k) =>
          !['assigned_to__first_name', 'assigned_to__last_name', 'assigned_to__email'].includes(k) ||
          groupBy !== 'manager'
      )
    : []

  // For manager groupBy, synthesize a "manager" column in display
  const isManager = groupBy === 'manager'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-semibold text-[var(--text)]">
          {t('nav.reports')}
        </h1>
        <button
          type="button"
          onClick={() => void exportCSV()}
          disabled={exporting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[var(--accent)] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          aria-label="Экспорт CSV"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {exporting ? 'Экспорт…' : 'Экспорт CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-4 space-y-4">
        {/* Entity selector */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Сущность</p>
            <div className="flex gap-2 flex-wrap">
              {(['deals', 'clients', 'tasks'] as Entity[]).map((e) => (
                <button
                  key={e}
                  onClick={() => handleEntityChange(e)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                    entity === e
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text)]'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Group by selector */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">Группировка</p>
            <div className="flex gap-2 flex-wrap">
              {GROUP_BY_OPTIONS[entity].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setGroupBy(opt.value)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    groupBy === opt.value
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Date range */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="space-y-1.5">
            <label htmlFor="date-from" className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">С</label>
            <input
              id="date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="date-to" className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">По</label>
            <input
              id="date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[var(--bg-hover)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors disabled:opacity-50"
          >
            {loading ? 'Загрузка...' : 'Применить'}
          </button>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo('') }}
              className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors"
            >
              Сбросить даты
            </button>
          )}
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          <strong className="text-[var(--text)]">Экспорт CSV</strong> скачивает все записи выбранной сущности
          (все основные поля, владельцы, связи, для клиентов — объединённые контакты). Диапазон <strong>С / По</strong>
          фильтрует строки по <code className="text-[11px] bg-[var(--bg-hover)] px-1 rounded">created_at</code>.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/30 text-[var(--danger)] rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Results */}
      {loading && (
        <div className="text-[var(--text-secondary)] text-sm py-8 text-center">Загружается отчёт...</div>
      )}

      {!loading && fetched && (
        <>
          {/* Summary card */}
          <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] px-5 py-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--text)]">{reportData.length}</p>
              <p className="text-sm text-[var(--text-secondary)]">
                групп найдено для <span className="font-medium capitalize text-[var(--text)]">{entity}</span>
                {' '}сгруппировано по <span className="font-medium text-[var(--text)]">{groupBy}</span>
              </p>
            </div>
          </div>

          {reportData.length === 0 ? (
            <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] py-16 text-center text-[var(--text-secondary)] text-sm">
              Данные по выбранным фильтрам не найдены.
            </div>
          ) : (
            <>
              {/* Bar chart */}
              <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] p-5">
                <h2 className="text-sm font-semibold text-[var(--text)] mb-4 uppercase tracking-wide">
                  {entity} — {groupBy}
                </h2>

                {/* Recharts bar chart */}
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      angle={chartData.length > 6 ? -30 : 0}
                      textAnchor={chartData.length > 6 ? 'end' : 'middle'}
                      height={chartData.length > 6 ? 50 : 30}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'var(--text)',
                      }}
                      cursor={{ fill: 'var(--bg-hover)' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={64}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Data table */}
              <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--border)]">
                  <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wide">Таблица данных</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                          #
                        </th>
                        {isManager && (
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                            Менеджер
</th>
                        )}
                        {(isManager
                          ? ['count', 'total_value']
                          : tableColumns
                        ).map((col) => (
                          <th
                            key={col}
                            className="px-4 py-2.5 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide"
                          >
                            {col.replace(/_/g, ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-[var(--border)]/50 last:border-0 hover:bg-[var(--bg-hover)] transition-colors"
                        >
                          <td className="px-4 py-2.5 text-[var(--text-secondary)]">{i + 1}</td>
                          {isManager && (
                            <td className="px-4 py-2.5 text-[var(--text)] font-medium">
                              {getRowLabel(row, groupBy)}
                            </td>
                          )}
                          {(isManager
                            ? ['count', 'total_value']
                            : tableColumns
                          ).map((col) => (
                            <td key={col} className="px-4 py-2.5 text-[var(--text)]">
                              {formatValue(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {!loading && !fetched && (
        <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] py-16 text-center text-[var(--text-secondary)] text-sm">
          Выберите фильтры выше и нажмите «Применить» для генерации отчёта.
        </div>
      )}
    </div>
  )
}
