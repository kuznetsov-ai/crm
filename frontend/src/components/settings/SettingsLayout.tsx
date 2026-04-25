import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const TABS = [
  { to: '/settings/roles', labelKey: 'settings.tabs.roles' },
  { to: '/settings/employees', labelKey: 'settings.tabs.employees' },
  { to: '/settings/integrations', labelKey: 'settings.tabs.integrations' },
  { to: '/settings/other', labelKey: 'settings.tabs.other' },
]

export default function SettingsLayout() {
  const { t } = useTranslation()

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-[var(--text)] mb-4">{t('nav.settings')}</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-6 overflow-x-auto">
        {TABS.map(({ to, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ` +
              (isActive
                ? 'text-[var(--accent)] border-[var(--accent)]'
                : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text)] hover:border-[var(--border)]')
            }
          >
            {t(labelKey)}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  )
}
