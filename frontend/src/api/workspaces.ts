import axios from './client'

export interface Workspace {
  id: number
  slug: string
  name: string
  subdomain: string | null
  is_active: boolean
  role: 'owner' | 'admin' | 'member' | 'guest' | null
}

export interface WorkspacesMeResponse {
  workspaces: Workspace[]
  current_workspace_slug: string | null
}

export const workspacesApi = {
  me: () => axios.get<WorkspacesMeResponse>('/workspaces/me/').then(r => r.data),
  switch: (slug: string) =>
    axios.post<{ slug: string; name: string }>('/workspaces/switch/', { slug }).then(r => r.data),
}
