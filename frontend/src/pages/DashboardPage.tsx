import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { dashboardApi, type DashboardStats, type DashboardPeriod } from '../api/dashboard'
import { dealsApi, type Deal } from '../api/deals'
import { useAuthStore } from '../stores/authStore'
import { useCurrencyStore } from '../stores/currencyStore'
import NextBestActionWidget from '../components/ai/NextBestActionWidget'

const FUNNEL_COLORS = ['#94a3b8', '#60a5fa', '#a78bfa', '#f59e0b', '#34d399', '#fd7448']

const PERIOD_KEYS: DashboardPeriod[] = ['all', 'month', 'quarter', 'year']

// ─── Icons ──────────────────────────────────────────────────────────────────

function ClientsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function PipelineIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
}

function TasksIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  )
}

function DealsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  )
}

function ConversionIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
      <polyline points="17 6 23 6 23 12"/>
    </svg>
  )
}

function TrophyIcon({ rank }: { rank: number }) {
  const colors = ['#f59e0b', '#94a3b8', '#cd7c3a']
  const color = colors[rank - 1] ?? '#94a3b8'
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  )
}

// ─── Components ──────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
  icon?: React.ReactNode
}) {
  return (
    <div className={`eds-stat ${accent ? '' : 'opacity-95'}`} style={{ borderLeftColor: accent ? 'var(--color-accent-eds)' : 'var(--color-border-eds)' }}>
      <div className="flex items-start gap-3">
        {icon && (
          <div className={`w-9 h-9 rounded-md flex items-center justify-center shrink-0 ${accent ? 'text-[var(--color-accent-eds)]' : 'text-[var(--text-secondary)]'}`}>
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="eds-stat__label">{label}</div>
          <div className="eds-stat__big" style={{ color: accent ? 'var(--color-accent-eds)' : 'var(--color-text-eds)' }}>{value}</div>
          {sub && <div className="eds-stat__sub">{sub}</div>}
        </div>
      </div>
    </div>
  )
}

function EmptyChart() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center h-[200px] text-[var(--text-secondary)]">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-30 mb-3">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
      <p className="text-sm">{t('common.noData')}</p>
    </div>
  )
}

interface ManagerStat {
  name: string
  dealCount: number
  totalValue: number
}

function TopManagersSection({ period }: { period: DashboardPeriod }) {
  const { t } = useTranslation()
  const currency = useCurrencyStore(s => s.currency)
  const rate = useCurrencyStore(s => s.rate)
  const [managers, setManagers] = useState<ManagerStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      dealsApi.list({ status: 'signed', page_size: '100' }),
      dealsApi.list({ status: 'active', page_size: '100' }),
    ]).then(([signedRes, activeRes]) => {
      const allDeals: Deal[] = [
        ...(signedRes.results ?? []),
        ...(activeRes.results ?? []),
      ]

      const map = new Map<string, ManagerStat>()
      for (const deal of allDeals) {
        const name = deal.assigned_to?.full_name ?? t('common.notAssigned')
        const value = parseFloat(deal.value_usd ?? '0') || 0
        const existing = map.get(name)
        if (existing) {
          existing.dealCount += 1
          existing.totalValue += value
        } else {
          map.set(name, { name, dealCount: 1, totalValue: value })
        }
      }

      const sorted = Array.from(map.values())
        .sort((a, b) => b.dealCount - a.dealCount || b.totalValue - a.totalValue)
        .slice(0, 3)

      setManagers(sorted)
    }).finally(() => setLoading(false))
  }, [period])

  const rankBadge = ['#1', '#2', '#3']
  const rankColors = [
    'text-[#f59e0b]',
    'text-[#94a3b8]',
    'text-[#cd7c3a]',
  ]

  if (loading) {
    return (
      <div className="flex gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex-1 bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)] animate-pulse h-24" />
        ))}
      </div>
    )
  }

  if (managers.length === 0) {
    return (
      <p className="text-sm text-[var(--text-secondary)]">{t('common.noData')}</p>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {managers.map((m, i) => (
        <div key={m.name} className="bg-[var(--bg-card)] rounded-lg p-4 border border-[var(--border)] flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            <TrophyIcon rank={i + 1} />
          </div>
          <div className="min-w-0 flex-1">
            <div className={`text-sm font-bold ${rankColors[i] ?? 'text-[var(--text)]'} mb-0.5`}>
              {rankBadge[i]}
            </div>
            <div className="text-sm font-medium text-[var(--text)] truncate">{m.name}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">
              {m.dealCount} {t('dashboard.dealsWord')}
              {m.totalValue > 0 && (
                <span className="ml-2 text-[var(--accent)] font-medium">
                  {(() => {
                    const symbol = currency === 'RUB' ? '₽' : '$'
                    const base = currency === 'RUB' && rate ? m.totalValue * rate : m.totalValue
                    return `${symbol}${Math.round(base / 1000)}K`
                  })()}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function FunnelWithConversions({ funnel }: { funnel: DashboardStats['funnel'] }) {
  const { t } = useTranslation()
  const hasFunnelData = funnel.some((f) => f.count > 0)

  // Compute conversion % to next stage
  const funnelWithConv = funnel.map((stage, i) => {
    const prevCount = i > 0 ? funnel[i - 1].count : null
    const convPct =
      prevCount !== null && prevCount > 0
        ? Math.round((stage.count / prevCount) * 100)
        : null
    return { ...stage, convPct }
  })

  if (!hasFunnelData) {
    return <EmptyChart />
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={funnel} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--text)',
            }}
            cursor={{ fill: 'var(--surface-2)', opacity: 0.5 }}
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={60}>
            {funnel.map((_, i) => (
              <Cell key={`cell-${i}`} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Conversion row */}
      <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${funnel.length}, 1fr)` }}>
        {funnelWithConv.map((stage, i) => (
          <div key={stage.status} className="text-center">
            <div className="text-xs font-semibold text-[var(--text)]">{stage.count}</div>
            {stage.convPct !== null ? (
              <div
                className="text-[10px] mt-0.5 font-medium"
                style={{ color: stage.convPct >= 50 ? '#34d399' : stage.convPct >= 25 ? '#f59e0b' : '#f87171' }}
              >
                {i > 0 && <span className="text-[var(--text-secondary)] mr-0.5">→</span>}
                {stage.convPct}%
              </div>
            ) : (
              <div className="text-[10px] mt-0.5 text-[var(--text-secondary)]">{t('dashboard.base')}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const currency = useCurrencyStore(s => s.currency)
  const rate = useCurrencyStore(s => s.rate)
  const [period, setPeriod] = useState<DashboardPeriod>('all')
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const PERIOD_OPTIONS: { key: DashboardPeriod; label: string }[] = [
    { key: 'all', label: t('dashboard.allTime') },
    { key: 'month', label: t('dashboard.thisMonth') },
    { key: 'quarter', label: t('dashboard.thisQuarter') },
    { key: 'year', label: t('dashboard.thisYear') },
  ]

  useEffect(() => {
    setLoading(true)
    dashboardApi.stats(period).then(setStats).finally(() => setLoading(false))
  }, [period])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex gap-2">
          {PERIOD_KEYS.map((k) => (
            <div key={k} className="h-8 w-24 bg-[var(--bg-card)] rounded-lg border border-[var(--border)] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[var(--bg-card)] rounded-lg p-5 border border-[var(--border)] animate-pulse h-24" />
          ))}
        </div>
      </div>
    )
  }

  if (!stats) {
    return <div className="text-[var(--danger)] text-sm">{t('common.error')}</div>
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{t('nav.dashboard')}</h1>
          {user && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {t('dashboard.welcome')}{' '}
              <span className="font-medium text-[var(--text)]">{user.first_name || user.email}</span>
            </p>
          )}
        </div>

        {/* Period filter */}
        <div className="flex items-center gap-1 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-1 self-start sm:self-auto">
          {PERIOD_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => setPeriod(o.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                period === o.key
                  ? 'bg-[var(--accent)] text-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label={t('dashboard.activeClients')}
          value={stats.clients.active}
          sub={`${stats.clients.new_30d} ${t('dashboard.newPerMonth')}`}
          icon={<ClientsIcon />}
        />
        <KpiCard
          label={t('dashboard.pipeline')}
          value={(() => {
            const symbol = currency === 'RUB' ? '₽' : '$'
            const base = currency === 'RUB' && rate
              ? stats.deals.pipeline_value_usd * rate
              : stats.deals.pipeline_value_usd
            return `${symbol}${Math.round(base / 1000)}K`
          })()}
          sub={`${stats.deals.active} ${t('dashboard.activeDeals')}`}
          accent
          icon={<PipelineIcon />}
        />
        <KpiCard
          label={t('dashboard.myTasks')}
          value={stats.tasks.my_open}
          sub={stats.tasks.overdue > 0 ? `${stats.tasks.overdue} ${t('dashboard.overdue')}` : t('common.allGood')}
          icon={<TasksIcon />}
        />
        <KpiCard
          label={t('dashboard.totalDeals')}
          value={stats.deals.total}
          sub={`${stats.clients.total} ${t('dashboard.clientsInBase')}`}
          icon={<DealsIcon />}
        />
        <KpiCard
          label={t('dashboard.conversion')}
          value={`${stats.deals.conversion_rate}%`}
          sub={t('dashboard.conversionDesc')}
          accent
          icon={<ConversionIcon />}
        />
      </div>

      {/* Sales Funnel */}
      <div className="bg-[var(--bg-card)] rounded-lg p-6 border border-[var(--border)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wide">{t('dashboard.salesFunnel')}</h2>
          <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] px-2 py-1 rounded-full">
            {stats.deals.total} {t('dashboard.dealsWord')}
          </span>
        </div>
        <FunnelWithConversions funnel={stats.funnel} />
      </div>

      {/* Next best action (AI) */}
      <NextBestActionWidget />

      {/* Top Managers */}
      <div className="bg-[var(--bg-card)] rounded-lg p-6 border border-[var(--border)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--text)] uppercase tracking-wide">{t('dashboard.topManagers')}</h2>
          <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-hover)] px-2 py-1 rounded-full">
            {t('dashboard.byActiveAndClosed')}
          </span>
        </div>
        <TopManagersSection period={period} />
      </div>
    </div>
  )
}
