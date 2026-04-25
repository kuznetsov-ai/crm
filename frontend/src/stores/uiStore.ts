import { create } from 'zustand'

export type Theme = 'light' | 'dark' | 'auto'
export type ResolvedTheme = 'light' | 'dark'

interface UiState {
  theme: Theme
  resolvedTheme: ResolvedTheme
  sidebarCollapsed: boolean
  toggleTheme: () => void
  cycleTheme: () => void
  setTheme: (t: Theme) => void
  toggleSidebar: () => void
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
}

function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'auto') return systemPrefersDark() ? 'dark' : 'light'
  return theme
}

function applyResolved(resolved: ResolvedTheme) {
  document.documentElement.setAttribute('data-theme', resolved)
}

function applyTheme(theme: Theme): ResolvedTheme {
  const resolved = resolveTheme(theme)
  applyResolved(resolved)
  localStorage.setItem('crm_theme', theme)
  return resolved
}

const storedTheme = localStorage.getItem('crm_theme') as Theme | null
const initialTheme: Theme = storedTheme ?? 'auto'
const initialResolved = applyTheme(initialTheme)
const savedCollapsed = localStorage.getItem('crm_sidebar') === 'collapsed'

export const useUiStore = create<UiState>((set) => ({
  theme: initialTheme,
  resolvedTheme: initialResolved,
  sidebarCollapsed: savedCollapsed,

  toggleTheme: () =>
    set((s) => {
      // Legacy API: cycle light ↔ dark (ignore auto here for backwards compat)
      const next: Theme = s.resolvedTheme === 'light' ? 'dark' : 'light'
      const resolved = applyTheme(next)
      return { theme: next, resolvedTheme: resolved }
    }),

  cycleTheme: () =>
    set((s) => {
      const order: Theme[] = ['light', 'dark', 'auto']
      const next = order[(order.indexOf(s.theme) + 1) % order.length]
      const resolved = applyTheme(next)
      return { theme: next, resolvedTheme: resolved }
    }),

  setTheme: (theme) => {
    const resolved = applyTheme(theme)
    set({ theme, resolvedTheme: resolved })
  },

  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarCollapsed
      localStorage.setItem('crm_sidebar', next ? 'collapsed' : 'expanded')
      return { sidebarCollapsed: next }
    }),
}))

// Subscribe to OS-level color-scheme changes; only affect UI when mode is 'auto'
if (typeof window !== 'undefined' && window.matchMedia) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  const listener = () => {
    const state = useUiStore.getState()
    if (state.theme === 'auto') {
      const resolved: ResolvedTheme = mql.matches ? 'dark' : 'light'
      applyResolved(resolved)
      useUiStore.setState({ resolvedTheme: resolved })
    }
  }
  if (mql.addEventListener) mql.addEventListener('change', listener)
  else if ('addListener' in mql) (mql as MediaQueryList).addListener(listener)
}
