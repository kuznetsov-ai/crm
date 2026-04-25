import { create } from 'zustand'
import type { DictionaryItem } from '../api/dictionaries'
import { sourcesApi, lostReasonsApi } from '../api/dictionaries'

interface State {
  sources: DictionaryItem[]
  lostReasons: DictionaryItem[]
  loading: boolean
  error: string | null
  fetchAll: () => Promise<void>
}

export const useDictionariesStore = create<State>()((set) => ({
  sources: [],
  lostReasons: [],
  loading: false,
  error: null,
  fetchAll: async () => {
    set({ loading: true, error: null })
    try {
      const [sources, lostReasons] = await Promise.all([
        sourcesApi.list(),
        lostReasonsApi.list(),
      ])
      set({ sources, lostReasons, loading: false })
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Failed to load dictionaries' })
    }
  },
}))
