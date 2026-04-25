import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Workspace } from '../api/workspaces'
import { workspacesApi } from '../api/workspaces'

interface WorkspaceState {
  workspaces: Workspace[]
  currentSlug: string | null
  isLoading: boolean
  error: string | null
  fetchMe: () => Promise<void>
  switchTo: (slug: string) => Promise<void>
  reset: () => void
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaces: [],
      currentSlug: null,
      isLoading: false,
      error: null,
      fetchMe: async () => {
        set({ isLoading: true, error: null })
        try {
          const data = await workspacesApi.me()
          set({
            workspaces: data.workspaces,
            currentSlug: data.current_workspace_slug,
            isLoading: false,
          })
        } catch (e: any) {
          set({ isLoading: false, error: e?.message ?? 'Failed to load workspaces' })
        }
      },
      switchTo: async (slug) => {
        await workspacesApi.switch(slug)
        set({ currentSlug: slug })
      },
      reset: () => set({ workspaces: [], currentSlug: null, error: null }),
    }),
    {
      name: 'crm_workspace',
      partialize: (s) => ({ currentSlug: s.currentSlug }),
    }
  )
)
