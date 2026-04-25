import { create } from 'zustand'
import { leadsApi, type Lead } from '../api/leads'

interface State {
  leads: Lead[]
  kanbanGroups: Record<number, Lead[]>
  loading: boolean
  error: string | null
  fetchLeads: (params?: Record<string, string>) => Promise<void>
  fetchKanban: (pipelineId?: number) => Promise<void>
  createLead: (payload: Partial<Lead>) => Promise<Lead>
  updateLead: (id: number, payload: Partial<Lead>) => Promise<Lead>
  deleteLead: (id: number) => Promise<void>
}

export const useLeadsStore = create<State>()((set, get) => ({
  leads: [],
  kanbanGroups: {},
  loading: false,
  error: null,

  fetchLeads: async (params) => {
    set({ loading: true, error: null })
    try {
      const result = await leadsApi.list(params)
      set({ leads: result.results, loading: false })
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Failed to load leads' })
    }
  },

  fetchKanban: async (pipelineId) => {
    set({ loading: true, error: null })
    try {
      const groups = await leadsApi.kanban(pipelineId)
      // convert keys to numbers
      const normalized: Record<number, Lead[]> = {}
      for (const [k, v] of Object.entries(groups)) {
        normalized[Number(k)] = v
      }
      set({ kanbanGroups: normalized, loading: false })
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Failed to load kanban' })
    }
  },

  createLead: async (payload) => {
    const lead = await leadsApi.create(payload)
    set((s) => ({ leads: [lead, ...s.leads] }))
    return lead
  },

  updateLead: async (id, payload) => {
    const updated = await leadsApi.update(id, payload)
    set((s) => ({
      leads: s.leads.map((l) => (l.id === id ? updated : l)),
    }))
    return updated
  },

  deleteLead: async (id) => {
    await leadsApi.delete(id)
    set((s) => ({ leads: s.leads.filter((l) => l.id !== id) }))
  },
}))
