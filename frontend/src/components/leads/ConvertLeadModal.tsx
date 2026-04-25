import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { pipelinesApi, type Pipeline, type Stage } from '../../api/pipelines'
import { leadsApi, type ConvertLeadBody } from '../../api/leads'
import type { Client } from '../../api/clients'
import { clientsApi } from '../../api/clients'

interface Props {
  leadId: number
  onSuccess: (dealId: number | null, clientId: number) => void
  onCancel: () => void
}

export default function ConvertLeadModal({ leadId, onSuccess, onCancel }: Props) {
  const { t } = useTranslation()

  const [createClient, setCreateClient] = useState(true)
  const [clientId, setClientId] = useState<number | ''>('')
  const [existingClients, setExistingClients] = useState<Client[]>([])

  const [createContact, setCreateContact] = useState(true)
  const [createDeal, setCreateDeal] = useState(true)

  const [dealPipelines, setDealPipelines] = useState<Pipeline[]>([])
  const [selectedPipelineId, setSelectedPipelineId] = useState<number | ''>('')
  const [selectedStageId, setSelectedStageId] = useState<number | ''>('')
  const [availableStages, setAvailableStages] = useState<Stage[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Load deal pipelines
    pipelinesApi.list('deal').then((ps) => {
      setDealPipelines(ps)
      const def = ps.find(p => p.is_default) ?? ps[0]
      if (def) {
        setSelectedPipelineId(def.id)
        setAvailableStages(def.stages)
        const firstStage = def.stages[0]
        if (firstStage) setSelectedStageId(firstStage.id)
      }
    })
    // Load existing clients for "use existing" option
    clientsApi.list({ page_size: '50' }).then((res) => {
      setExistingClients(res.results)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const p = dealPipelines.find(p => p.id === Number(selectedPipelineId))
    if (p) {
      setAvailableStages(p.stages)
      const firstStage = p.stages[0]
      if (firstStage) setSelectedStageId(firstStage.id)
    }
  }, [selectedPipelineId, dealPipelines])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const body: ConvertLeadBody = {
        create_client: createClient,
        client_id: !createClient && clientId ? Number(clientId) : undefined,
        create_contact: createContact,
        create_deal: createDeal,
        deal_pipeline_id: createDeal && selectedPipelineId ? Number(selectedPipelineId) : undefined,
        deal_stage_id: createDeal && selectedStageId ? Number(selectedStageId) : undefined,
      }
      const result = await leadsApi.convert(leadId, body)
      onSuccess(result.deal_id, result.client_id)
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? err?.message ?? t('common.error')
      setError(detail)
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-sm px-3 py-2 outline-none focus:border-[var(--accent)] transition-colors w-full'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-[var(--bg-card)] rounded-2xl shadow-xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-semibold text-[var(--text)] mb-5">
          {t('leads.convert_modal.title')}
        </h2>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Client section */}
          <div className="rounded-lg border border-[var(--border)] p-3 flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={createClient}
                onChange={e => setCreateClient(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-[var(--text)]">
                {t('leads.convert_modal.create_client')}
              </span>
            </label>

            {!createClient && (
              <div>
                <label className="text-xs text-[var(--text-secondary)] mb-1 block">
                  {t('leads.convert_modal.existing_client')}
                </label>
                <select
                  value={clientId}
                  onChange={e => setClientId(Number(e.target.value) || '')}
                  required={!createClient}
                  className={inputCls}
                >
                  <option value="">— {t('leads.convert_modal.select_client')} —</option>
                  {existingClients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Contact section */}
          <div className="rounded-lg border border-[var(--border)] p-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={createContact}
                onChange={e => setCreateContact(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-[var(--text)]">
                {t('leads.convert_modal.create_contact')}
              </span>
            </label>
          </div>

          {/* Deal section */}
          <div className="rounded-lg border border-[var(--border)] p-3 flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={createDeal}
                onChange={e => setCreateDeal(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm font-medium text-[var(--text)]">
                {t('leads.convert_modal.create_deal')}
              </span>
            </label>

            {createDeal && (
              <>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">
                    {t('leads.convert_modal.deal_pipeline')}
                  </label>
                  <select
                    value={selectedPipelineId}
                    onChange={e => setSelectedPipelineId(Number(e.target.value))}
                    className={inputCls}
                  >
                    {dealPipelines.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--text-secondary)] mb-1 block">
                    {t('leads.convert_modal.deal_stage')}
                  </label>
                  <select
                    value={selectedStageId}
                    onChange={e => setSelectedStageId(Number(e.target.value))}
                    className={inputCls}
                  >
                    {availableStages.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || (!createClient && !clientId)}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {submitting ? t('common.saving') : t('leads.convert')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
