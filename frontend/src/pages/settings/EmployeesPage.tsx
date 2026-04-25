import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../api/client'
import type { UserProfile } from '../../api/auth'

interface Role {
  id: number
  name: string
  preset: string
}

export default function EmployeesPage() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<Record<number, string>>({})
  const [savingUserRole, setSavingUserRole] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      api.get('/users/').then(r => Array.isArray(r.data) ? r.data : r.data.results ?? []),
      api.get('/users/roles/').then(r => Array.isArray(r.data) ? r.data : r.data.results ?? []),
    ]).then(([u, r]) => {
      setUsers(u)
      setRoles(r)
      const map: Record<number, string> = {}
      u.forEach((usr: UserProfile) => { if (usr.role) map[usr.id] = String(usr.role.id) })
      setUserRole(map)
    }).finally(() => setLoading(false))
  }, [])

  const handleChangeUserRole = async (userId: number, roleId: string) => {
    setSavingUserRole(userId)
    setUserRole(prev => ({ ...prev, [userId]: roleId }))
    try {
      await api.patch(`/users/${userId}/`, { role: roleId ? Number(roleId) : null })
      setUsers(prev => prev.map(u => u.id === userId
        ? { ...u, role: roles.find(r => r.id === Number(roleId)) ?? null }
        : u
      ))
    } finally { setSavingUserRole(null) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[var(--text)]">
          {t('settings.usersTitle')} ({users.length})
        </h2>
        <button
          disabled
          title="Coming soon"
          className="text-sm border border-[var(--border)] text-[var(--text-secondary)] px-3 py-1.5 rounded-lg opacity-50 cursor-not-allowed"
        >
          {t('settings.inviteUser', '+ Пригласить')}
        </button>
      </div>

      <div className="space-y-2">
        {users.length === 0 && (
          <p className="text-sm text-[var(--text-secondary)]">{t('settings.noUsers')}</p>
        )}
        {users.map(u => (
          <div key={u.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-[var(--accent)]/15 flex items-center justify-center text-xs font-bold text-[var(--accent)] shrink-0">
              {(u.full_name || u.email)[0].toUpperCase()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-[var(--text)] truncate">{u.full_name || '—'}</div>
              <div className="text-xs text-[var(--text-secondary)] truncate">{u.email}</div>
            </div>

            {/* Joined */}
            {u.created_at && (
              <div className="hidden md:block text-xs text-[var(--text-secondary)] shrink-0">
                {new Date(u.created_at).toLocaleDateString('ru-RU')}
              </div>
            )}

            {/* Role select */}
            <div className="flex items-center gap-2 shrink-0">
              {savingUserRole === u.id && (
                <div className="w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              )}
              <select
                value={userRole[u.id] ?? ''}
                onChange={e => handleChangeUserRole(u.id, e.target.value)}
                className="text-xs border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] rounded px-2 py-1 focus:outline-none focus:border-[var(--accent)] max-w-[160px]"
              >
                <option value="">{t('settings.noRole')}</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>

              {/* Status dot */}
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${u.is_active ? 'bg-[var(--success,#22c55e)]' : 'bg-[var(--danger,#ef4444)]'}`}
                title={u.is_active ? t('settings.active') : t('settings.inactive')}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
