import api from './client'
import type { CustomFieldValues } from './customFields'

export type ContactRole = 'decision_maker' | 'manager' | 'secretary' | 'other'
export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  decision_maker: 'ЛПР',
  manager: 'Менеджер',
  secretary: 'Секретарь',
  other: 'Другое',
}

export interface Contact {
  id: number
  client: number
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string
  position: string
  linkedin: string
  telegram: string
  whatsapp: string
  role: ContactRole
  order: number
  is_primary: boolean
  language_pref: 'ru' | 'en'
  notes: string
  created_at: string
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export interface RiskFactor { code: string; weight: number; detail: string }

export interface Client {
  id: number
  name: string
  industry: string
  website: string
  country: string
  company_size: string
  status: 'lead' | 'prospect' | 'active' | 'paused' | 'churned'
  tech_stack: string[]
  budget_range: string
  description: string
  tax_id: string
  tax_id_country: string
  risk_score: number
  risk_level: RiskLevel
  risk_factors: RiskFactor[]
  risk_notes: string
  risk_overridden: boolean
  risk_override_at: string | null
  sync_status: string
  sync_error: string
  last_synced_at: string | null
  sync_data: {
    enriched?: Record<string, unknown>
    egrul?: {
      name_short?: string; name_full?: string; ogrn?: string; inn?: string; kpp?: string;
      address?: string; status?: string; registration_date?: string;
      director?: { full_name: string; position: string };
      okved_main?: { code: string; name: string };
      okved_additional?: { code: string; name: string }[];
      founders?: { name: string; share_pct?: string }[];
    };
    financials?: { available: boolean; found?: boolean; revenue_rub?: number; net_profit_rub?: number; employees?: number; reason?: string };
    hh?: { hh_id: string; name: string; domain?: string; logo?: string }[];
  }
  assigned_to: { id: number; full_name: string; email: string } | null
  created_by: { id: number; full_name: string; email: string } | null
  contacts: Contact[]
  contacts_count: number
  custom_fields: CustomFieldValues
  created_at: string
  updated_at: string
}

export interface ClientListItem {
  id: number
  name: string
  industry: string
  status: Client['status']
  company_size: string
  budget_range: string
  assigned_to: { id: number; full_name: string } | null
  contacts_count: number
  tax_id: string
  tax_id_country: string
  risk_score: number
  risk_level: RiskLevel
  created_at: string
}

export interface ClientDocument {
  id: number
  name: string
  size: number
  url: string | null
  uploaded_by_name: string | null
  created_at: string
}

export type NoteKind = 'note' | 'meeting' | 'call' | 'transcript' | 'decision'

export interface ClientNote {
  id: number
  client: number
  kind: NoteKind
  title: string
  body: string
  author: { id: number; full_name: string; email: string } | null
  pinned: boolean
  created_at: string
  updated_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export const clientsApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<ClientListItem>> => {
    const { data } = await api.get('/clients/', { params })
    return data
  },
  get: async (id: number): Promise<Client> => {
    const { data } = await api.get(`/clients/${id}/`)
    return data
  },
  create: async (payload: Partial<Client>): Promise<Client> => {
    const { data } = await api.post('/clients/', payload)
    return data
  },
  update: async (id: number, payload: Partial<Client>): Promise<Client> => {
    const { data } = await api.patch(`/clients/${id}/`, payload)
    return data
  },
  delete: async (id: number): Promise<void> => { await api.delete(`/clients/${id}/`) },
  bulk: async (action: string, ids: number[], data: Record<string, unknown> = {}): Promise<{ updated?: number; deleted?: number }> => {
    const res = await api.post('/clients/bulk/', { action, ids, data })
    return res.data
  },
  checkTaxId: async (tax_id: string, country: string = 'RU'): Promise<{
    normalized: string; valid: boolean; reason?: string;
    duplicates: { id: number; name: string; status: string; country: string; industry: string }[]
  }> => {
    const { data } = await api.post('/clients/check-tax-id/', { tax_id, country })
    return data
  },
  sync: async (id: number): Promise<{ queued: boolean; client_id: number }> => {
    const { data } = await api.post(`/clients/${id}/sync/`)
    return data
  },
  riskRecalc: async (id: number, force: boolean = false): Promise<{
    score: number; level: RiskLevel; factors?: RiskFactor[]; skipped?: boolean; reason?: string
  }> => {
    const { data } = await api.post(`/clients/${id}/risk/recalc/${force ? '?force=1' : ''}`)
    return data
  },
  riskOverride: async (id: number, payload: { level?: RiskLevel; score?: number; notes?: string; clear?: boolean }): Promise<unknown> => {
    const { data } = await api.post(`/clients/${id}/risk/override/`, payload)
    return data
  },
  importCsv: async (file: File, dryRun: boolean = true): Promise<{
    created: number; errors: { row: number; reason: string }[]; preview: unknown[];
    total_rows: number; dry_run: boolean;
  }> => {
    const fd = new FormData()
    fd.append('file', file)
    if (dryRun) fd.append('dry_run', '1')
    const { data } = await api.post('/clients/import/', fd)
    return data
  },
  contacts: {
    list: async (clientId: number): Promise<Contact[]> => {
      const { data } = await api.get(`/clients/${clientId}/contacts/`)
      return Array.isArray(data) ? data : data.results ?? []
    },
    create: async (clientId: number, payload: Partial<Contact>): Promise<Contact> => {
      const { data } = await api.post(`/clients/${clientId}/contacts/`, payload)
      return data
    },
    update: async (clientId: number, contactId: number, payload: Partial<Contact>): Promise<Contact> => {
      const { data } = await api.patch(`/clients/${clientId}/contacts/${contactId}/`, payload)
      return data
    },
    delete: async (clientId: number, contactId: number): Promise<void> => {
      await api.delete(`/clients/${clientId}/contacts/${contactId}/`)
    },
  },
  notes: {
    list: async (clientId: number): Promise<ClientNote[]> => {
      const { data } = await api.get(`/clients/${clientId}/notes/`)
      return Array.isArray(data) ? data : data.results ?? []
    },
    create: async (clientId: number, payload: Partial<ClientNote>): Promise<ClientNote> => {
      const { data } = await api.post(`/clients/${clientId}/notes/`, payload)
      return data
    },
    update: async (clientId: number, noteId: number, payload: Partial<ClientNote>): Promise<ClientNote> => {
      const { data } = await api.patch(`/clients/${clientId}/notes/${noteId}/`, payload)
      return data
    },
    delete: async (clientId: number, noteId: number): Promise<void> => {
      await api.delete(`/clients/${clientId}/notes/${noteId}/`)
    },
  },
  documents: {
    list: async (clientId: number): Promise<ClientDocument[]> => {
      const { data } = await api.get(`/clients/${clientId}/documents/`)
      return Array.isArray(data) ? data : data.results ?? []
    },
    upload: async (clientId: number, file: File): Promise<ClientDocument> => {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post(`/clients/${clientId}/documents/`, fd)
      return data
    },
    delete: async (clientId: number, docId: number): Promise<void> => {
      await api.delete(`/clients/${clientId}/documents/${docId}/`)
    },
  },
}
