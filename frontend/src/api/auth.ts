import api from './client'

export interface LoginCredentials {
  email: string
  password: string
}

export interface UserProfile {
  id: number
  email: string
  first_name: string
  last_name: string
  full_name: string
  avatar: string | null
  language: 'ru' | 'en'
  role: {
    id: number
    name: string
    preset: string
  } | null
  permissions: {
    can_manage_users: boolean
    can_manage_deals: boolean
    can_manage_clients: boolean
    can_view_reports: boolean
    can_manage_settings: boolean
  }
  is_active: boolean
  created_at: string
}

export const authApi = {
  login: async (credentials: LoginCredentials) => {
    const { data } = await api.post('/token/', credentials)
    localStorage.setItem('access_token', data.access)
    localStorage.setItem('refresh_token', data.refresh)
    return data
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
  },

  me: async (): Promise<UserProfile> => {
    const { data } = await api.get('/users/me/')
    return data
  },
}
