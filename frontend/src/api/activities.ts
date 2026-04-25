import api from './client'

export type ActivityType =
  | 'note'
  | 'call'
  | 'email'
  | 'meeting'
  | 'task'
  | 'stage_change'
  | 'field_change'
  | 'created'
  | 'ai'

export type ActivityEntity = 'lead' | 'deal' | 'client'

export interface ActivityAuthor {
  id: number
  email: string
  full_name: string
}

export interface Activity {
  id: number
  workspace: number
  type: ActivityType
  entity: ActivityEntity
  entity_id: number
  author: ActivityAuthor | null
  subject: string
  body: string
  meta: Record<string, unknown>
  due_at: string | null
  completed_at: string | null
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export interface CreateActivityPayload {
  type: ActivityType
  entity: ActivityEntity
  entity_id: number
  subject?: string
  body?: string
  meta?: Record<string, unknown>
  due_at?: string | null
}

export interface UpdateActivityPayload {
  subject?: string
  body?: string
  meta?: Record<string, unknown>
  due_at?: string | null
  is_pinned?: boolean
}

export interface ListActivitiesParams {
  entity: ActivityEntity
  entity_id: number
  types?: ActivityType[]
}

interface PaginatedActivities {
  count: number
  next: string | null
  previous: string | null
  results: Activity[]
}

const activitiesApi = {
  list(params: ListActivitiesParams): Promise<Activity[]> {
    const qp: Record<string, string> = {
      entity: params.entity,
      entity_id: String(params.entity_id),
    }
    if (params.types && params.types.length > 0) {
      qp.types = params.types.join(',')
    }
    return api
      .get<PaginatedActivities | Activity[]>('/activities/', { params: qp })
      .then((r) => {
        const data = r.data
        if (Array.isArray(data)) return data
        return (data as PaginatedActivities).results
      })
  },

  create(payload: CreateActivityPayload): Promise<Activity> {
    return api.post<Activity>('/activities/', payload).then((r) => r.data)
  },

  update(id: number, payload: UpdateActivityPayload): Promise<Activity> {
    return api.patch<Activity>(`/activities/${id}/`, payload).then((r) => r.data)
  },

  remove(id: number): Promise<void> {
    return api.delete(`/activities/${id}/`).then(() => undefined)
  },

  complete(id: number): Promise<Activity> {
    return api.post<Activity>(`/activities/${id}/complete/`).then((r) => r.data)
  },

  pin(id: number): Promise<Activity> {
    return api.post<Activity>(`/activities/${id}/pin/`).then((r) => r.data)
  },
}

export default activitiesApi
