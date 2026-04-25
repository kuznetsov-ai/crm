import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { leadsApi, type Lead, type StageChangeRecord } from '../api/leads'
import ConvertLeadModal from '../components/leads/ConvertLeadModal'
import CustomFieldsRenderer from '../components/common/CustomFieldsRenderer'
import type { CustomFieldValues } from '../api/customFields'
import ActivityTimeline from '../components/common/ActivityTimeline'
import { useCurrencyStore } from '../stores/currencyStore'

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-[var(--border)] last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
        {label}
      </span>
      <span className="text-sm text-[var(--text)]">{children}</span>
    </div>
  )
}

function InlineEdit({
  label,
  value,
  onSave,
  type = 'text',
}: {
  label: string
  value: string
  onSave: (v: string) => void
  type?: string
}) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => { setDraft(value) }, [value])

  function handleSave() {
    setEditing(false)
    if (draft !== value) onSave(draft)
  }

  return (
    <div className="flex flex-col gap-0.5 py-3 border-b border-[var(--border)] last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
        {label}
      </span>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
            autoFocus
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-sm px-2 py-1 outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={handleSave}
            className="text-xs px-2 py-1 rounded bg-[var(--accent)] text-white hover:opacity-90"
          >
            {t('common.save')}
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-xs px-2 py-1 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            {t('common.cancel')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="flex items-center gap-2 text-left text-sm text-[var(--text)] cursor-pointer hover:text-[var(--accent)] rounded px-1 -mx-1 py-0.5 hover:bg-[var(--bg-hover)] transition-colors"
          onClick={() => setEditing(true)}
          aria-label={`${t('common.edit')} — ${label}`}
        >
          <span className="flex-1">{value || <span className="text-[var(--text-secondary)]">—</span>}</span>
          <span className="text-[12px] text-[var(--text-secondary)] shrink-0" aria-hidden="true">✎</span>
        </button>
      )}
    </div>
  )
}

function formatDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const currency = useCurrencyStore(s => s.currency)

  const [lead, setLead] = useState<Lead | null>(null)
  const [history, setHistory] = useState<StageChangeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'history' | 'timeline'>('overview')
  const [convertOpen, setConvertOpen] = useState(false)
  const [customFields, setCustomFields] = useState<CustomFieldValues>({})

  const numId = Number(id)

  useEffect(() => {
    if (!numId) return
    setLoading(true)
    Promise.all([
      leadsApi.get(numId),
      leadsApi.history(numId),
    ]).then(([l, h]) => {
      setLead(l)
      setCustomFields(l.custom_fields ?? {})
      setHistory(h)
    }).finally(() => setLoading(false))
  }, [numId])

  async function handlePatch(patch: Partial<Lead>) {
    if (!lead) return
    try {
      const updated = await leadsApi.update(lead.id, patch)
      setLead(updated)
    } catch (e: any) {
      console.error('Failed to update lead', e)
    }
  }

  async function handleCustomFieldChange(patch: CustomFieldValues) {
    if (!lead) return
    const updated = await leadsApi.update(lead.id, { custom_fields: patch } as Partial<Lead>)
    setCustomFields(updated.custom_fields ?? {})
  }

  if (loading) {
    return <div className="p-6 text-[var(--text-secondary)] text-sm">{t('common.loading')}</div>
  }

  if (!lead) {
    return (
      <div className="p-6">
        <p className="text-[var(--text-secondary)]">{t('common.noData')}</p>
        <Link to="/leads" className="text-[var(--accent)] text-sm hover:underline mt-2 inline-block">
          ← {t('common.back')}
        </Link>
      </div>
    )
  }

  const isConverted = !!lead.converted_at

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-4 shrink-0">
        <Link to="/leads" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)]">
          ← {t('leads.title')}
        </Link>
        <h1 className="text-xl font-semibold text-[var(--text)] flex-1 min-w-0 truncate">
          {lead.title}
        </h1>

        {/* Stage badge */}
        {lead.stage_name && (
          <span
            className="px-2.5 py-1 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: '#6B7280' }}
          >
            {lead.stage_name}
          </span>
        )}

        {/* Convert button */}
        {!isConverted ? (
          <button
            type="button"
            onClick={() => setConvertOpen(true)}
            className="bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-[var(--radius-md)] hover:opacity-90 transition-opacity"
          >
            {t('leads.convert')}
          </button>
        ) : (
          <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
            {t('leads.converted')} {formatDate(lead.converted_at)}
          </span>
        )}
      </div>

      {/* Converted references */}
      {isConverted && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 text-sm flex flex-wrap gap-4">
          {lead.converted_client && (
            <Link to={`/clients/${lead.converted_client}`} className="text-emerald-700 hover:underline font-medium">
              {t('leads.convert_modal.client')}: {lead.converted_client_name ?? `#${lead.converted_client}`}
            </Link>
          )}
          {lead.converted_deal && (
            <Link to={`/deals/${lead.converted_deal}`} className="text-emerald-700 hover:underline font-medium">
              {t('leads.convert_modal.deal')}: #{lead.converted_deal}
            </Link>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-[var(--border)] shrink-0">
        {(['overview', 'timeline', 'history'] as const).map(t2 => (
          <button
            key={t2}
            type="button"
            onClick={() => setTab(t2)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t2
                ? 'text-[var(--accent)] border-[var(--accent)]'
                : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text)]'
            }`}
          >
            {t2 === 'overview' ? t('leads.tab_overview') : t2 === 'timeline' ? t('activities.title') : t('leads.tab_history')}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'overview' && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Contact info */}
            <div className="flex-1 min-w-0 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
              <h2 className="text-sm font-semibold text-[var(--text)] mb-1">{t('leads.section_contact')}</h2>
              <InlineEdit
                label={t('leads.field_first_name')}
                value={lead.first_name}
                onSave={v => handlePatch({ first_name: v })}
              />
              <InlineEdit
                label={t('leads.field_last_name')}
                value={lead.last_name}
                onSave={v => handlePatch({ last_name: v })}
              />
              <InlineEdit
                label={t('leads.field_phone')}
                value={lead.phone}
                type="tel"
                onSave={v => handlePatch({ phone: v })}
              />
              <InlineEdit
                label={t('leads.field_email')}
                value={lead.email}
                type="email"
                onSave={v => handlePatch({ email: v })}
              />
              <h2 className="text-sm font-semibold text-[var(--text)] mt-4 mb-1">{t('leads.section_company')}</h2>
              <InlineEdit
                label={t('leads.field_company_name')}
                value={lead.company_name}
                onSave={v => handlePatch({ company_name: v })}
              />
              <InlineEdit
                label={t('leads.field_tax_id')}
                value={lead.tax_id}
                onSave={v => handlePatch({ tax_id: v })}
              />
              <InlineEdit
                label={t('leads.field_website')}
                value={lead.website}
                type="url"
                onSave={v => handlePatch({ website: v })}
              />
              <InlineEdit
                label={t('leads.field_title')}
                value={lead.title}
                onSave={v => handlePatch({ title: v })}
              />
            </div>

            {/* Right: Pipeline + meta */}
            <div className="w-full lg:w-72 bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
              <h2 className="text-sm font-semibold text-[var(--text)] mb-1">{t('leads.section_pipeline')}</h2>
              <FieldRow label={t('leads.field_pipeline')}>{lead.pipeline_name ?? '—'}</FieldRow>
              <FieldRow label={t('leads.field_stage')}>{lead.stage_name ?? '—'}</FieldRow>
              <FieldRow label={t('leads.field_source')}>{lead.source_name ?? '—'}</FieldRow>
              <FieldRow label={t('leads.field_opportunity')}>
                {lead.opportunity
                  ? `${currency === 'RUB' ? '₽' : '$'} ${Number(lead.opportunity).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`
                  : '—'}
              </FieldRow>
              <FieldRow label={t('leads.field_assignee')}>{lead.assignee?.full_name ?? '—'}</FieldRow>
              <FieldRow label={t('leads.field_created')}>{formatDate(lead.created_at)}</FieldRow>
              <FieldRow label={t('leads.field_updated')}>{formatDate(lead.updated_at)}</FieldRow>
              {/* Custom fields */}
              <div className="mt-4 pt-4 border-t border-[var(--border)]">
                <CustomFieldsRenderer
                  entity="lead"
                  entityId={lead.id}
                  values={customFields}
                  onChange={handleCustomFieldChange}
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'timeline' && lead && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
            <ActivityTimeline entity="lead" entityId={lead.id} />
          </div>
        )}

        {tab === 'history' && (
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5">
            <h2 className="text-sm font-semibold text-[var(--text)] mb-3">{t('leads.tab_history')}</h2>
            {history.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">{t('common.noData')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {history.map(h => (
                  <div key={h.id} className="flex items-center gap-3 py-2 border-b border-[var(--border)] last:border-0">
                    <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                      <span>{h.from_stage_name ?? '—'}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                      <span className="text-[var(--text)] font-medium">{h.to_stage_name}</span>
                    </div>
                    <span className="ml-auto text-xs text-[var(--text-secondary)]">
                      {formatDate(h.at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {convertOpen && (
        <ConvertLeadModal
          leadId={lead.id}
          onSuccess={(dealId, _clientId) => {
            setConvertOpen(false)
            leadsApi.get(lead.id).then(setLead)
            if (dealId) navigate(`/deals/${dealId}`)
          }}
          onCancel={() => setConvertOpen(false)}
        />
      )}
    </div>
  )
}
