import axios from './client'

export type StageSemantic = 'open' | 'won' | 'lost' | 'converted'

export interface Stage {
  id: number
  pipeline: number
  name: string
  code: string
  semantic: StageSemantic
  color: string
  order: number
}

export interface Pipeline {
  id: number
  kind: 'lead' | 'deal'
  name: string
  is_default: boolean
  order: number
  is_active: boolean
  stages: Stage[]
}

export const pipelinesApi = {
  list: (kind: 'lead' | 'deal' = 'deal') =>
    axios.get<{ results: Pipeline[] }>(`/pipelines/?kind=${kind}`).then(r => r.data.results),
  get: (id: number) =>
    axios.get<Pipeline>(`/pipelines/${id}/`).then(r => r.data),
  create: (data: Partial<Pipeline> & { kind: 'lead' | 'deal'; name: string }) =>
    axios.post<Pipeline>('/pipelines/', data).then(r => r.data),
  update: (id: number, data: Partial<Pipeline>) =>
    axios.patch<Pipeline>(`/pipelines/${id}/`, data).then(r => r.data),
  remove: (id: number) => axios.delete(`/pipelines/${id}/`).then(() => undefined),
}

export const stagesApi = {
  create: (data: Partial<Stage> & { pipeline: number; name: string; code: string }) =>
    axios.post<Stage>('/stages/', data).then(r => r.data),
  update: (id: number, data: Partial<Stage>) =>
    axios.patch<Stage>(`/stages/${id}/`, data).then(r => r.data),
  remove: (id: number) => axios.delete(`/stages/${id}/`).then(() => undefined),
}
