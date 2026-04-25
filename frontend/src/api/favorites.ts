import api from './client'

export type FavoriteEntityType = 'client' | 'deal' | 'task'

export interface Favorite {
  id: number
  entity_type: FavoriteEntityType
  entity_id: number
  created_at: string
}

export const favoritesApi = {
  list: async (): Promise<Favorite[]> => {
    const { data } = await api.get('/favorites/')
    return Array.isArray(data) ? data : data.results ?? []
  },
  listFor: async (entityType: FavoriteEntityType): Promise<Favorite[]> => {
    const { data } = await api.get('/favorites/', { params: { entity_type: entityType } })
    return Array.isArray(data) ? data : data.results ?? []
  },
  toggle: async (entityType: FavoriteEntityType, entityId: number): Promise<{ favorited: boolean }> => {
    const { data } = await api.post('/favorites/toggle/', { entity_type: entityType, entity_id: entityId })
    return data
  },
}
