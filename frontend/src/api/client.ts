import axios from 'axios'
import { BYPASS_AUTH } from '../stores/authStore'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.request.use((config) => {
  const slug = useWorkspaceStore.getState().currentSlug
  if (slug) {
    config.headers.set('X-Workspace-Slug', slug)
  }
  return config
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`
        return api(originalRequest)
      })
    }
    originalRequest._retry = true
    isRefreshing = true
    try {
      const refresh = localStorage.getItem('refresh_token')
      if (!refresh) throw new Error('No refresh token')
      const { data } = await axios.post('/api/token/refresh/', { refresh })
      localStorage.setItem('access_token', data.access)
      if (data.refresh) localStorage.setItem('refresh_token', data.refresh)
      processQueue(null, data.access)
      originalRequest.headers.Authorization = `Bearer ${data.access}`
      return api(originalRequest)
    } catch (err) {
      processQueue(err, null)
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      if (!BYPASS_AUTH) {
        window.location.href = '/login'
      }
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  }
)

export default api
