import { useState, useEffect } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuthStore, BYPASS_AUTH } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'
import { useFavoritesStore } from '../../stores/favoritesStore'
import { useCurrencyStore } from '../../stores/currencyStore'
import Sidebar from './Sidebar'
import Header from './Header'
import DemoBanner from './DemoBanner'
import GlobalSearch from '../search/GlobalSearch'

export default function AppLayout() {
  const { isAuthenticated, isLoading } = useAuthStore()
  const { sidebarCollapsed } = useUiStore()
  const loadFavorites = useFavoritesStore((s) => s.load)
  const favoritesLoaded = useFavoritesStore((s) => s.loaded)
  const loadCurrency = useCurrencyStore((s) => s.load)
  const currencyLoaded = useCurrencyStore((s) => s.loaded)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !favoritesLoaded) {
      loadFavorites()
    }
  }, [isLoading, favoritesLoaded, loadFavorites])

  useEffect(() => {
    if (!isLoading && !currencyLoaded) {
      loadCurrency()
    }
  }, [isLoading, currencyLoaded, loadCurrency])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
        <div className="text-[var(--text-secondary)] text-sm animate-pulse">Загрузка...</div>
      </div>
    )
  }

  if (!BYPASS_AUTH && !isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-screen bg-[var(--bg-main)] overflow-hidden">
      {/* Mobile overlay backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar — drawer on mobile, collapsible on desktop */}
      <div
        className={`
          fixed md:static inset-y-0 left-0 z-50 md:z-auto
          transform transition-transform duration-300 ease-in-out
          ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ width: sidebarCollapsed ? '64px' : '240px' }}
      >
        <Sidebar onClose={() => setMobileSidebarOpen(false)} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <DemoBanner />
        <Header
          onMenuClick={() => setMobileSidebarOpen(s => !s)}
          sidebarOpen={mobileSidebarOpen}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <GlobalSearch />
    </div>
  )
}
