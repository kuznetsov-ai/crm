import { create } from 'zustand'
import type { CustomFieldDef, EntityType } from '../api/customFields'
import { customFieldsApi } from '../api/customFields'

interface State {
  defsByEntity: Record<EntityType, CustomFieldDef[]>
  loading: Record<EntityType, boolean>
  fetchDefs: (entity: EntityType) => Promise<void>
  invalidate: (entity: EntityType) => void
}

const emptyByEntity = (): Record<EntityType, CustomFieldDef[]> => ({
  client: [],
  deal: [],
  lead: [],
})

const emptyLoading = (): Record<EntityType, boolean> => ({
  client: false,
  deal: false,
  lead: false,
})

export const useCustomFieldsStore = create<State>()((set, get) => ({
  defsByEntity: emptyByEntity(),
  loading: emptyLoading(),

  fetchDefs: async (entity: EntityType) => {
    const { loading } = get()
    if (loading[entity]) return
    set((s) => ({ loading: { ...s.loading, [entity]: true } }))
    try {
      const defs = await customFieldsApi.listDefs(entity)
      set((s) => ({
        defsByEntity: { ...s.defsByEntity, [entity]: defs },
        loading: { ...s.loading, [entity]: false },
      }))
    } catch {
      set((s) => ({ loading: { ...s.loading, [entity]: false } }))
    }
  },

  invalidate: (entity: EntityType) => {
    set((s) => ({
      defsByEntity: { ...s.defsByEntity, [entity]: [] },
      loading: { ...s.loading, [entity]: false },
    }))
  },
}))
