import api from './client'

export interface DemoInfo {
  demo_mode: boolean
  last_reset: number
  last_reset_iso: string | null
  reset_interval_hours: number
  demo_user_email: string
}

export const demoApi = {
  info: () => api.get<DemoInfo>('/demo/info').then(r => r.data),
  reset: () => api.post('/demo/reset').then(r => r.data),
}
