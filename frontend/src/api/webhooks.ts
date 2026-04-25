import api from './client'

export interface WebhookEndpoint {
  id: number
  name: string
  url: string
  events: string[]
  secret: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface WebhookDelivery {
  id: number
  endpoint: number
  event: string
  status_code: number
  response_snippet: string
  error: string
  duration_ms: number
  created_at: string
}

export const webhooksApi = {
  list: async (): Promise<WebhookEndpoint[]> => {
    const { data } = await api.get('/webhooks/endpoints/')
    return Array.isArray(data) ? data : data.results ?? []
  },
  create: async (payload: Partial<WebhookEndpoint>): Promise<WebhookEndpoint> => {
    const { data } = await api.post('/webhooks/endpoints/', payload)
    return data
  },
  update: async (id: number, payload: Partial<WebhookEndpoint>): Promise<WebhookEndpoint> => {
    const { data } = await api.patch(`/webhooks/endpoints/${id}/`, payload)
    return data
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/webhooks/endpoints/${id}/`)
  },
  deliveries: async (): Promise<WebhookDelivery[]> => {
    const { data } = await api.get('/webhooks/deliveries/')
    return Array.isArray(data) ? data : data.results ?? []
  },
}

export const WEBHOOK_EVENTS = [
  { value: 'deal.created', label: 'Сделка создана' },
  { value: 'deal.updated', label: 'Сделка обновлена' },
  { value: 'deal.won', label: 'Сделка выиграна' },
  { value: 'deal.lost', label: 'Сделка проиграна' },
  { value: 'client.created', label: 'Клиент создан' },
  { value: 'task.created', label: 'Задача создана' },
]
