import api from './client'

export interface DashboardStats {
  clients: { total: number; active: number; new_30d: number }
  deals: { total: number; active: number; pipeline_value_usd: number; conversion_rate: number }
  funnel: { status: string; label: string; count: number }[]
  tasks: { my_open: number; overdue: number }
}

export type DashboardPeriod = 'all' | 'month' | 'quarter' | 'year'

export const dashboardApi = {
  stats: async (period: DashboardPeriod = 'all'): Promise<DashboardStats> => {
    const { data } = await api.get('/dashboard/stats/', { params: { period } })
    return data
  },
}
