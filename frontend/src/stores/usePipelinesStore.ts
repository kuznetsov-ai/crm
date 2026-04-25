import { create } from 'zustand'
import type { Pipeline } from '../api/pipelines'
import { pipelinesApi } from '../api/pipelines'

interface State {
  pipelines: Pipeline[]
  currentId: number | null
  loading: boolean
  error: string | null
  fetch: (kind?: 'deal' | 'lead') => Promise<void>
  setCurrent: (id: number) => void
  refetch: () => Promise<void>
}

export const usePipelinesStore = create<State>()((set, get) => ({
  pipelines: [],
  currentId: null,
  loading: false,
  error: null,
  fetch: async (kind = 'deal') => {
    set({ loading: true, error: null })
    try {
      const pipelines = await pipelinesApi.list(kind)
      const currentId = get().currentId && pipelines.find(p => p.id === get().currentId)
        ? get().currentId
        : (pipelines.find(p => p.is_default)?.id ?? pipelines[0]?.id ?? null)
      set({ pipelines, currentId, loading: false })
    } catch (e: any) {
      set({ loading: false, error: e?.message ?? 'Failed to load pipelines' })
    }
  },
  setCurrent: (id) => set({ currentId: id }),
  refetch: async () => { await get().fetch('deal') },
}))
