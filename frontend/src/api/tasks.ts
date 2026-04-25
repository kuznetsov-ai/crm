import api from './client'
import type { PaginatedResponse } from './clients'

export interface Task {
  id: number
  title: string
  description: string
  assigned_to: { id: number; full_name: string; email: string } | null
  assigned_to_id?: number
  created_by: { id: number; full_name: string } | null
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'todo' | 'in_progress' | 'done'
  deadline: string | null
  linked_client: number | null
  linked_deal: number | null
  is_overdue: boolean
  created_at: string
  updated_at: string
}

export const PRIORITY_COLORS = {
  low: 'text-[var(--text-secondary)]',
  medium: 'text-[var(--info)]',
  high: 'text-[var(--warning)]',
  urgent: 'text-[var(--danger)]',
} as const

export const PRIORITY_LABELS = { low: 'Низкий', medium: 'Средний', high: 'Высокий', urgent: 'Срочный' } as const
export const STATUS_LABELS = { todo: 'К выполнению', in_progress: 'В работе', done: 'Готово' } as const

export const tasksApi = {
  list: async (params?: Record<string, string>): Promise<PaginatedResponse<Task>> => {
    const { data } = await api.get('/tasks/', { params })
    return data
  },
  get: async (id: number): Promise<Task> => {
    const { data } = await api.get(`/tasks/${id}/`)
    return data
  },
  create: async (payload: Partial<Task>): Promise<Task> => {
    const { data } = await api.post('/tasks/', payload)
    return data
  },
  update: async (id: number, payload: Partial<Task>): Promise<Task> => {
    const { data } = await api.patch(`/tasks/${id}/`, payload)
    return data
  },
  delete: async (id: number): Promise<void> => { await api.delete(`/tasks/${id}/`) },
}
