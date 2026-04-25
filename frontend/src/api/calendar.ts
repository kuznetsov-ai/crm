import api from './client'

export interface CalendarEvent {
  id: number
  title: string
  event_type: 'event' | 'reminder' | 'busy'
  start_datetime: string
  end_datetime: string | null
  all_day: boolean
  description: string
  color: string
  created_by: number
  created_by_name: string
  created_at: string
}

export const calendarApi = {
  list: async (dateFrom: string, dateTo: string): Promise<CalendarEvent[]> => {
    const { data } = await api.get(`/calendar/events/?date_from=${dateFrom}&date_to=${dateTo}`)
    return Array.isArray(data) ? data : data.results ?? []
  },
  create: async (payload: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const { data } = await api.post('/calendar/events/', payload)
    return data
  },
  update: async (id: number, payload: Partial<CalendarEvent>): Promise<CalendarEvent> => {
    const { data } = await api.patch(`/calendar/events/${id}/`, payload)
    return data
  },
  delete: async (id: number): Promise<void> => {
    await api.delete(`/calendar/events/${id}/`)
  },
}
