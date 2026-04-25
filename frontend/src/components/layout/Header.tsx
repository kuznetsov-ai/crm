import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import { useUiStore } from '../../stores/uiStore'
import i18n from '../../i18n/index'
import NotificationBell from './NotificationBell'
import WorkspaceSwitcher from './WorkspaceSwitcher'

interface Props {
  onMenuClick: () => void
  sidebarOpen: boolean
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}

function AutoThemeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/>
    </svg>
  )
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {collapsed ? (
        <>
          <polyline points="9 18 15 12 9 6"/>
        </>
      ) : (
        <>
          <polyline points="15 18 9 12 15 6"/>
        </>
      )}
    </svg>
  )
}

export default function Header({ onMenuClick, sidebarOpen }: Props) {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()
  const { theme, resolvedTheme, cycleTheme, sidebarCollapsed, toggleSidebar } = useUiStore()

  const toggleLang = () => {
    const next = i18n.language === 'ru' ? 'en' : 'ru'
    i18n.changeLanguage(next)
    localStorage.setItem('crm_lang', next)
  }

  const initials = user
    ? `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || user.email[0].toUpperCase()
    : '?'

  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--bg-card)] flex items-center px-4 gap-3 shrink-0">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors shrink-0"
        aria-label="Toggle menu"
      >
        <span className={`block w-5 h-0.5 bg-[var(--text)] transition-all duration-300 ${sidebarOpen ? 'rotate-45 translate-y-2' : ''}`} />
        <span className={`block w-5 h-0.5 bg-[var(--text)] transition-all duration-300 ${sidebarOpen ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-[var(--text)] transition-all duration-300 ${sidebarOpen ? '-rotate-45 -translate-y-2' : ''}`} />
      </button>

      {/* Desktop sidebar collapse toggle */}
      <button
        onClick={toggleSidebar}
        className="hidden md:flex w-8 h-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={sidebarCollapsed ? t('common.expandMenu') : t('common.collapseMenu')}
      >
        <CollapseIcon collapsed={sidebarCollapsed} />
      </button>

      {/* Workspace switcher */}
      <WorkspaceSwitcher />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <NotificationBell />

        {/* Theme toggle: cycles light → dark → auto */}
        <button
          onClick={cycleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
          aria-label="Cycle theme"
          title={theme === 'auto' ? t('common.autoTheme') : resolvedTheme === 'dark' ? t('common.lightTheme') : t('common.darkTheme')}
        >
          {theme === 'auto' ? <AutoThemeIcon /> : resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors px-2 py-1 rounded border border-[var(--border)] hover:border-[var(--accent)] min-w-[36px] text-center cursor-pointer"
        >
          {i18n.language === 'ru' ? 'EN' : 'RU'}
        </button>

        {/* User avatar + logout */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center text-xs font-bold shrink-0 select-none">
            {initials}
          </div>
          <span className="hidden sm:block text-sm font-medium text-[var(--text)] max-w-[120px] truncate">
            {user?.first_name || user?.email?.split('@')[0] || 'User'}
          </span>
          <button
            onClick={logout}
            className="text-xs text-[var(--text-secondary)] hover:text-[var(--danger)] transition-colors whitespace-nowrap"
          >
            {t('auth.logout')}
          </button>
        </div>
      </div>
    </header>
  )
}
