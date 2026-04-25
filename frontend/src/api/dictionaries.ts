import axios from './client'

export interface DictionaryItem {
  id: number
  code: string
  name: string
  is_active: boolean
  order: number
}

export const sourcesApi = {
  list: () =>
    axios.get<{ results: DictionaryItem[] } | DictionaryItem[]>('/sources/').then(r => {
      const d = r.data
      return Array.isArray(d) ? d : d.results
    }),
  create: (data: Omit<DictionaryItem, 'id'>) =>
    axios.post<DictionaryItem>('/sources/', data).then(r => r.data),
  update: (id: number, data: Partial<DictionaryItem>) =>
    axios.patch<DictionaryItem>(`/sources/${id}/`, data).then(r => r.data),
  remove: (id: number) => axios.delete(`/sources/${id}/`).then(() => undefined),
}

export const lostReasonsApi = {
  list: () =>
    axios.get<{ results: DictionaryItem[] } | DictionaryItem[]>('/lost-reasons/').then(r => {
      const d = r.data
      return Array.isArray(d) ? d : d.results
    }),
  create: (data: Omit<DictionaryItem, 'id'>) =>
    axios.post<DictionaryItem>('/lost-reasons/', data).then(r => r.data),
  update: (id: number, data: Partial<DictionaryItem>) =>
    axios.patch<DictionaryItem>(`/lost-reasons/${id}/`, data).then(r => r.data),
  remove: (id: number) => axios.delete(`/lost-reasons/${id}/`).then(() => undefined),
}
