import api from './client'

export type FieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'enum'
  | 'multi_enum'
  | 'url'
  | 'email'

export type EntityType = 'client' | 'deal' | 'lead'

export interface FieldOption {
  code: string
  label: string
}

export interface CustomFieldDef {
  id: number
  workspace: number
  entity: EntityType
  code: string
  label: string
  type: FieldType
  options: FieldOption[]
  required: boolean
  order: number
  is_active: boolean
  help_text: string
}

export type CustomFieldValues = Record<string, unknown>

export interface ReorderPayload {
  entity: EntityType
  ids: number[]
}

const BASE = '/custom-fields/defs'

export const customFieldsApi = {
  listDefs: async (entity?: EntityType): Promise<CustomFieldDef[]> => {
    const params = entity ? { entity } : {}
    const { data } = await api.get<{ results: CustomFieldDef[] } | CustomFieldDef[]>(
      `${BASE}/`,
      { params }
    )
    return Array.isArray(data) ? data : data.results
  },

  getDef: async (id: number): Promise<CustomFieldDef> => {
    const { data } = await api.get<CustomFieldDef>(`${BASE}/${id}/`)
    return data
  },

  createDef: async (payload: Omit<CustomFieldDef, 'id' | 'workspace'>): Promise<CustomFieldDef> => {
    const { data } = await api.post<CustomFieldDef>(`${BASE}/`, payload)
    return data
  },

  updateDef: async (id: number, payload: Partial<CustomFieldDef>): Promise<CustomFieldDef> => {
    const { data } = await api.patch<CustomFieldDef>(`${BASE}/${id}/`, payload)
    return data
  },

  deleteDef: async (id: number): Promise<void> => {
    await api.delete(`${BASE}/${id}/`)
  },

  reorder: async (payload: ReorderPayload): Promise<void> => {
    await api.post(`${BASE}/reorder/`, payload)
  },
}
