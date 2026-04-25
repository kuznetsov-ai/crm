import { create } from 'zustand'
import { authApi, type UserProfile, type LoginCredentials } from '../api/auth'

// When true, skip token check — backend auto-auths as admin
export const BYPASS_AUTH = true

interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (credentials) => {
    await authApi.login(credentials)
    const user = await authApi.me()
    set({ user, isAuthenticated: true })
  },

  logout: () => {
    authApi.logout()
    set({ user: null, isAuthenticated: false })
    window.location.href = '/login'
  },

  fetchMe: async () => {
    if (BYPASS_AUTH) {
      try {
        // Try existing token first
        let user = await authApi.me().catch(() => null)
        if (!user) {
          // Auto-login as admin so all API calls have a valid token
          await authApi.login({ email: 'demo@studio.crm', password: 'admin123' })
          user = await authApi.me()
        }
        set({ user, isLoading: false, isAuthenticated: true })
      } catch {
        // Fallback: mark authenticated so app doesn't redirect to login
        set({ isLoading: false, isAuthenticated: true })
      }
      return
    }
    const token = localStorage.getItem('access_token')
    if (!token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }
    try {
      const user = await authApi.me()
      set({ user, isAuthenticated: true, isLoading: false })
    } catch {
      set({ isLoading: false, isAuthenticated: false })
    }
  },
}))
