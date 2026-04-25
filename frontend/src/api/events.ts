import api from './client'
import type { PaginatedResponse } from './clients'

export type CalendarEventType = 'meeting' | 'call' | 'other'

export interface CalendarEventRecord {
  id: number
  title: string
  description: string
  start_time: string
  end_time: string
  is_all_day: boolean
  event_type: CalendarEventType
  assigned_to: number
  linked_client: number | null
  linked_deal: number | null
  external_id: string | null
  created_at: string
  updated_at: string
}

export const EVENT_TYPE_LABELS: Record<CalendarEventType, string> = {
  meeting: 'Meeting',
  call: 'Call',
  other: 'Other',
}

export const eventsApi = {
  list: async (params?: Record<string, string>): Promise<CalendarEventRecord[]> => {
    const { data } = await api.get<PaginatedResponse<CalendarEventRecord>>('/events/', {
      params: { page_size: '200', ...params },
    })
    return data.results ?? []
  },
  get: async (id: number): Promise<CalendarEventRecord> => {
    const { data } = await api.get<CalendarEventRecord>(`/events/${id}/`)
    return data
  },
  create: async (payload: Partial<CalendarEventRecord>): Promise<CalendarEventRecord> => {
    const { data } = await api.post<CalendarEventRecord>('/events/', payload)
    return data
  },
  update: async (id: number, payload: Partial<CalendarEventRecord>): Promise<CalendarEventRecord> => {
    const { data } = await api.patch<CalendarEventRecord>(`/events/${id}/`, payload)
    return data
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/events/${id}/`)
  },
}
