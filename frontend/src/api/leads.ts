import api from './client'
import type { PaginatedResponse } from './clients'
import type { CustomFieldValues } from './customFields'

export interface Lead {
  id: number
  title: string
  first_name: string
  last_name: string
  phone: string
  email: string
  company_name: string
  tax_id: string
  website: string
  pipeline: number | null
  stage: number | null
  source: number | null
  lost_reason: number | null
  lost_comment: string
  pipeline_name: string | null
  stage_name: string | null
  stage_code: string | null
  stage_semantic: string | null
  source_name: string | null
  lost_reason_name: string | null
  opportunity: string | null
  currency: string
  assignee: { id: number; email: string; full_name: string } | null
  assignee_id?: number
  assignee_email: string | null
  converted_client: number | null
  converted_deal: number | null
  converted_at: string | null
  converted_client_name: string | null
  custom_fields: CustomFieldValues
  workspace: number
  created_at: string
  updated_at: string
}

export interface ConvertLeadBody {
  create_client: boolean
  client_id?: number | null
  create_contact: boolean
  create_deal: boolean
  deal_pipeline_id?: number | null
  deal_stage_id?: number | null
}

export interface ConvertLeadResult {
  lead: Lead
  client_id: number
  contact_id: number | null
  deal_id: number | null
}

export interface StageChangeRecord {
  id: number
  entity_type: string
  entity_id: number
  from_stage: number | null
  from_stage_code: string | null
  from_stage_name: string | null
  to_stage: number
  to_stage_code: string
  to_stage_name: string
  user: number | null
  comment: string
  at: string
}

export const leadsApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<Lead>> => {
    const { data } = await api.get('/leads/', { params })
    return data
  },
  get: async (id: number): Promise<Lead> => {
    const { data } = await api.get(`/leads/${id}/`)
    return data
  },
  create: async (payload: Partial<Lead>): Promise<Lead> => {
    const { data } = await api.post('/leads/', payload)
    return data
  },
  update: async (id: number, payload: Partial<Lead>): Promise<Lead> => {
    const { data } = await api.patch(`/leads/${id}/`, payload)
    return data
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/leads/${id}/`)
  },
  kanban: async (pipelineId?: number): Promise<Record<number, Lead[]>> => {
    const params: Record<string, string> = {}
    if (pipelineId) params.pipeline_id = String(pipelineId)
    const { data } = await api.get('/leads/kanban/', { params })
    return data
  },
  convert: async (id: number, body: ConvertLeadBody): Promise<ConvertLeadResult> => {
    const { data } = await api.post(`/leads/${id}/convert/`, body)
    return data
  },
  history: async (id: number): Promise<StageChangeRecord[]> => {
    const { data } = await api.get(`/leads/${id}/history/`)
    return Array.isArray(data) ? data : data.results ?? []
  },
}
