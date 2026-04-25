import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { clientsApi, type ClientListItem } from '../api/clients'
import ClientStatusBadge from '../components/clients/ClientStatusBadge'
import RiskBadge from '../components/clients/RiskBadge'
import StarButton from '../components/common/StarButton'
import LeadEnrichModal from '../components/ai/LeadEnrichModal'
import BulkActionBar from '../components/clients/BulkActionBar'
import CsvImportModal from '../components/clients/CsvImportModal'
import CreateClientModal from '../components/clients/CreateClientModal'

const STATUS_OPTIONS = ['lead', 'prospect', 'active', 'paused', 'churned'] as const
const STATUS_LABELS: Record<typeof STATUS_OPTIONS[number], string> = {
  lead: 'Лид',
  prospect: 'Потенциальный',
  active: 'Активный',
  paused: 'На паузе',
  churned: 'Потерян',
}
const COMPANY_SIZE_OPTIONS = ['1-10', '11-50', '51-200', '200+'] as const

type SortKey = 'newest' | 'oldest' | 'name_asc' | 'name_desc'

const SORT_KEYS: SortKey[] = ['newest', 'oldest', 'name_asc', 'name_desc']

const SORT_TO_ORDERING: Record<SortKey, string> = {
  newest: '-created_at',
  oldest: 'created_at',
  name_asc: 'name',
  name_desc: '-name',
}

export default function ClientsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'newest', label: t('clients.sortNewest') },
    { value: 'oldest', label: t('clients.sortOldest') },
    { value: 'name_asc', label: t('clients.sortNameAsc') },
    { value: 'name_desc', label: t('clients.sortNameDesc') },
  ]

  const [clients, setClients] = useState<ClientListItem[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [filterStatus, setFilterStatus] = useState('')
  const [filterIndustry, setFilterIndustry] = useState('')
  const [filterSize, setFilterSize] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')
  const [enrichOpen, setEnrichOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const toggleAllSelected = () => {
    setSelectedIds((prev) => {
      if (prev.size === clients.length) return new Set()
      return new Set(clients.map((c) => c.id))
    })
  }

  // Derive unique industries from loaded data for a dynamic dropdown
  const industryOptions = useMemo(() => {
    const set = new Set(clients.map((c) => c.industry).filter(Boolean))
    return Array.from(set).sort()
  }, [clients])

  const activeFilterCount = [filterStatus, filterIndustry, filterSize].filter(Boolean).length

  const load = async (q?: string) => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (q) params.search = q
      if (filterStatus) params.status = filterStatus
      if (filterSize) params.company_size = filterSize
      params.ordering = SORT_TO_ORDERING[sort]
      const data = await clientsApi.list(params)
      // Industry filtering is client-side since backend may not support it as a filterset field
      const results = filterIndustry
        ? data.results.filter((c) => c.industry?.toLowerCase().includes(filterIndustry.toLowerCase()))
        : data.results
      setClients(results)
      setCount(filterIndustry ? results.length : data.count)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(search || undefined) }, [filterStatus, filterSize, sort])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load(search || undefined)
  }

  const clearFilters = () => {
    setFilterStatus('')
    setFilterIndustry('')
    setFilterSize('')
    setSort('newest')
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text)] min-w-0">
          {t('nav.clients')}
          <span className="ml-2 text-[var(--text-secondary)] text-base sm:text-lg font-normal">({count})</span>
        </h1>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <button
            onClick={() => setCsvOpen(true)}
            className="text-[var(--text-secondary)] text-sm font-medium px-3 py-2 rounded-[var(--radius-md)] border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors inline-flex items-center gap-1.5 shrink-0"
            title="Импорт из CSV"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            CSV
          </button>
          <button
            onClick={() => setEnrichOpen(true)}
            className="text-[var(--accent)] text-sm font-medium px-4 py-2 rounded-[var(--radius-md)] border border-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors inline-flex items-center gap-1.5 shrink-0"
            title="AI: найти клиента по домену"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/></svg>
            AI lookup
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="bg-[var(--accent)] text-white text-sm font-medium px-4 py-2 rounded-[var(--radius-md)] hover:opacity-90 transition-opacity shrink-0 ml-auto sm:ml-0"
          >
            + {t('clients.add')}
          </button>
        </div>
      </div>

      <LeadEnrichModal
        open={enrichOpen}
        onClose={() => setEnrichOpen(false)}
        onCreated={(c) => { navigate(`/clients/${c.id}`) }}
      />
      <CsvImportModal
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        onImported={() => load(search)}
      />
      <BulkActionBar
        selectedIds={Array.from(selectedIds)}
        onClear={() => setSelectedIds(new Set())}
        onReload={() => load(search)}
      />
      <CreateClientModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(c) => { setCreateOpen(false); navigate(`/clients/${c.id}`) }}
      />

      {/* Search + Filter bar */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-3 flex-wrap">
        <input
          type="text"
          placeholder={t('clients.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-0 max-w-xs rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          className="border border-[var(--border)] text-[var(--text)] text-sm px-3 py-2 rounded-[var(--radius-md)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          {t('common.search')}
        </button>

        {/* Filter toggle button */}
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`relative flex items-center gap-1.5 text-sm px-3 py-2 rounded-[var(--radius-md)] border transition-colors
            ${filtersOpen || activeFilterCount > 0
              ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/8'
              : 'border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-hover)]'}`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0">
            <path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {t('clients.filters')}
          {activeFilterCount > 0 && (
            <span className="ml-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[var(--accent)] text-white text-[10px] font-semibold px-1">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] rounded-[var(--radius-md)] px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Clear filters */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm text-[var(--danger)] border border-[var(--danger)]/40 px-3 py-2 rounded-[var(--radius-md)] hover:bg-[var(--danger)]/8 transition-colors"
          >
            {t('clients.clearFilters')}
          </button>
        )}
      </form>

      {/* Collapsible filter panel */}
      {filtersOpen && (
        <div className="mb-4 p-4 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg flex flex-wrap gap-4">
          {/* Status */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">{t('clients.colStatus')}</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] rounded-[var(--radius-md)] px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">{t('clients.allStatuses')}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Industry */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">{t('clients.colIndustry')}</label>
            {industryOptions.length > 0 ? (
              <select
                value={filterIndustry}
                onChange={(e) => setFilterIndustry(e.target.value)}
                className="text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] rounded-[var(--radius-md)] px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
              >
                <option value="">{t('clients.allIndustries')}</option>
                {industryOptions.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder={t('clients.industryPlaceholder')}
                value={filterIndustry}
                onChange={(e) => setFilterIndustry(e.target.value)}
                className="text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] rounded-[var(--radius-md)] px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
              />
            )}
          </div>

          {/* Company size */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">{t('clients.allSizes')}</label>
            <select
              value={filterSize}
              onChange={(e) => setFilterSize(e.target.value)}
              className="text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] rounded-[var(--radius-md)] px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
            >
              <option value="">{t('clients.allSizes')}</option>
              {COMPANY_SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>
      ) : clients.length === 0 ? (
        <div className="text-[var(--text-secondary)] text-sm">{t('common.noData')}</div>
      ) : (
        <div className="bg-[var(--bg-card)] rounded-[var(--radius-xl)] border border-[var(--border)] overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={clients.length > 0 && selectedIds.size === clients.length}
                    onChange={toggleAllSelected}
                    aria-label="select all"
                  />
                </th>
                {[t('clients.colCompany'), t('clients.colIndustry'), t('clients.colStatus'), 'РИСК', 'ИНН', t('clients.colManager'), t('clients.colContacts'), t('clients.colCreated')].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-[var(--text-secondary)] px-4 py-3 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-[var(--bg-hover)] transition-colors">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(client.id)}
                      onChange={() => toggleSelected(client.id)}
                      aria-label={`select ${client.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StarButton entityType="client" entityId={client.id} size={15} />
                      <Link to={`/clients/${client.id}`} className="font-medium text-sm text-[var(--accent)] hover:underline">
                        {client.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{client.industry || '—'}</td>
                  <td className="px-4 py-3"><ClientStatusBadge status={client.status} /></td>
                  <td className="px-4 py-3"><RiskBadge level={client.risk_level ?? 'low'} score={client.risk_score} /></td>
                  <td className="px-4 py-3 text-xs font-mono text-[var(--text-secondary)]">{client.tax_id || '—'}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{client.assigned_to?.full_name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{client.contacts_count}</td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                    {new Date(client.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
