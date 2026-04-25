import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../stores/authStore'
import i18n from '../../i18n/index'
import NotificationBell from './NotificationBell'
import WorkspaceSwitcher from './WorkspaceSwitcher'

interface Props {
  onMenuClick: () => void
  sidebarOpen: boolean
}

export default function Header({ onMenuClick, sidebarOpen }: Props) {
  const { t } = useTranslation()
  const { user, logout } = useAuthStore()

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
      {/* Mobile hamburger — only on phones; desktop collapse lives inside Sidebar */}
      <button
        onClick={onMenuClick}
        className="md:hidden w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors shrink-0"
        aria-label="Toggle menu"
      >
        <span className={`block w-5 h-0.5 bg-[var(--text)] transition-all duration-300 ${sidebarOpen ? 'rotate-45 translate-y-2' : ''}`} />
        <span className={`block w-5 h-0.5 bg-[var(--text)] transition-all duration-300 ${sidebarOpen ? 'opacity-0' : ''}`} />
        <span className={`block w-5 h-0.5 bg-[var(--text)] transition-all duration-300 ${sidebarOpen ? '-rotate-45 -translate-y-2' : ''}`} />
      </button>

      {/* Workspace switcher */}
      <WorkspaceSwitcher />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <NotificationBell />

        {/* Theme toggle removed — design system is dark-only.
            Keeping the icon would be a fake control (no light theme exists). */}

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
