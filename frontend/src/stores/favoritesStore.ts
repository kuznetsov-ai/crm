import { create } from 'zustand'
import { favoritesApi, type FavoriteEntityType } from '../api/favorites'

interface FavoritesState {
  // Map of "type:id" → true
  favorites: Record<string, true>
  loaded: boolean
  load: () => Promise<void>
  toggle: (type: FavoriteEntityType, id: number) => Promise<void>
  isFavorite: (type: FavoriteEntityType, id: number) => boolean
  listOfType: (type: FavoriteEntityType) => number[]
}

const key = (type: FavoriteEntityType, id: number) => `${type}:${id}`

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: {},
  loaded: false,

  load: async () => {
    try {
      const list = await favoritesApi.list()
      const map: Record<string, true> = {}
      list.forEach((f) => {
        map[key(f.entity_type, f.entity_id)] = true
      })
      set({ favorites: map, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  toggle: async (type, id) => {
    const k = key(type, id)
    // Optimistic update
    const current = !!get().favorites[k]
    set((s) => {
      const next = { ...s.favorites }
      if (current) delete next[k]
      else next[k] = true
      return { favorites: next }
    })
    try {
      const res = await favoritesApi.toggle(type, id)
      // Reconcile with server
      set((s) => {
        const next = { ...s.favorites }
        if (res.favorited) next[k] = true
        else delete next[k]
        return { favorites: next }
      })
    } catch {
      // Rollback
      set((s) => {
        const next = { ...s.favorites }
        if (current) next[k] = true
        else delete next[k]
        return { favorites: next }
      })
    }
  },

  isFavorite: (type, id) => !!get().favorites[key(type, id)],

  listOfType: (type) =>
    Object.keys(get().favorites)
      .filter((k) => k.startsWith(`${type}:`))
      .map((k) => parseInt(k.split(':')[1], 10)),
}))
