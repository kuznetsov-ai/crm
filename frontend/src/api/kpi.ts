import api from './client'

export type KPIPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year'

export type KPIMetric = 'deals_count' | 'revenue_usd' | 'new_leads' | 'tasks_done' | 'clients_added'

export const METRIC_LABELS: Record<KPIMetric, string> = {
  deals_count: 'Количество сделок',
  revenue_usd: 'Выручка USD',
  new_leads: 'Новые лиды',
  tasks_done: 'Задачи выполнены',
  clients_added: 'Новые клиенты',
}

export const PERIOD_LABELS: Record<KPIPeriod, string> = {
  day: 'День',
  week: 'Неделя',
  month: 'Месяц',
  quarter: 'Квартал',
  year: 'Год',
}

export interface KPITarget {
  id: number
  assigned_to_id: number | null
  assigned_to_name: string | null
  metric: KPIMetric
  period: KPIPeriod
  year: number
  period_number: number
  target_value: string
  created_at: string
}

export interface KPISummaryItem {
  id: number
  metric: KPIMetric
  period: KPIPeriod
  year: number
  period_number: number
  target_value: string
  actual_value: string
  percentage: number
  assigned_to_id: number | null
  assigned_to_name: string | null
}

export interface CreateKPITargetPayload {
  metric: KPIMetric
  period: KPIPeriod
  year: number
  period_number: number
  target_value: string
  assigned_to_id?: number | null
}

export const kpiApi = {
  listTargets: async (params?: Record<string, string | number>): Promise<KPITarget[]> => {
    const { data } = await api.get('/kpi/targets/', { params })
    // Handle both paginated and plain list responses
    return Array.isArray(data) ? data : (data.results ?? [])
  },

  createTarget: async (payload: CreateKPITargetPayload): Promise<KPITarget> => {
    const { data } = await api.post('/kpi/targets/', payload)
    return data
  },

  deleteTarget: async (id: number): Promise<void> => {
    await api.delete(`/kpi/targets/${id}/`)
  },

  getSummary: async (params: {
    period: KPIPeriod
    year: number
    period_number: number
    user_id?: number | null
  }): Promise<KPISummaryItem[]> => {
    const cleanParams: Record<string, string | number> = {
      period: params.period,
      year: params.year,
      period_number: params.period_number,
    }
    if (params.user_id) cleanParams.user_id = params.user_id
    const { data } = await api.get('/kpi/summary/', { params: cleanParams })
    return Array.isArray(data) ? data : []
  },
}
