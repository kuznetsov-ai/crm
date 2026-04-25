import api from './client'

export type RateCardRole =
  | 'ba' | 'sa'
  | 'dev_junior' | 'dev_middle' | 'dev_senior' | 'dev_lead'
  | 'qa' | 'devops' | 'pm' | 'other'

export type RateCardUnit = 'hourly' | 'monthly'

export interface RateCard {
  id: number
  client: number
  role: RateCardRole
  role_label: string
  role_custom: string
  unit: RateCardUnit
  bill_rate_usd: string
  cost_rate_usd: string
  margin_usd: number
  margin_pct: number
  notes: string
  created_at: string
  updated_at: string
}

export const rateCardsApi = {
  list: async (clientId: number): Promise<RateCard[]> => {
    const { data } = await api.get(`/clients/${clientId}/rate-cards/`)
    return Array.isArray(data) ? data : data.results ?? []
  },
  create: async (clientId: number, payload: Partial<RateCard>): Promise<RateCard> => {
    const { data } = await api.post(`/clients/${clientId}/rate-cards/`, payload)
    return data
  },
  update: async (clientId: number, cardId: number, payload: Partial<RateCard>): Promise<RateCard> => {
    const { data } = await api.patch(`/clients/${clientId}/rate-cards/${cardId}/`, payload)
    return data
  },
  delete: async (clientId: number, cardId: number): Promise<void> => {
    await api.delete(`/clients/${clientId}/rate-cards/${cardId}/`)
  },
}
