import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import api from '../api/client'
import type { UserProfile } from '../api/auth'
import WebhooksSection from '../components/settings/WebhooksSection'

interface Role {
  id: number
  name: string
  preset: string
  can_manage_users: boolean
  can_manage_deals: boolean
  can_manage_clients: boolean
  can_view_reports: boolean
  can_manage_settings: boolean
}

const PERM_KEYS: { key: keyof Role; tKey: string; icon: string }[] = [
  { key: 'can_manage_users',    tKey: 'settings.permUsers',    icon: '👥' },
  { key: 'can_manage_deals',    tKey: 'settings.permDeals',    icon: '💼' },
  { key: 'can_manage_clients',  tKey: 'settings.permClients',  icon: '🏢' },
  { key: 'can_view_reports',    tKey: 'settings.permReports',  icon: '📊' },
  { key: 'can_manage_settings', tKey: 'settings.permSettings', icon: '⚙️'  },
]

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`relative inline-flex w-9 h-5 rounded-full transition-colors shrink-0 focus:outline-none
        ${value ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform mt-[3px]
        ${value ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
    </button>
  )
}

function RoleCard({ role, onUpdate }: { role: Role; onUpdate: (updated: Role) => void }) {
  const { t } = useTranslation()
  const [saving, setSaving] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(role.name)

  const togglePerm = async (key: keyof Role) => {
    if (saving) return
    setSaving(String(key))
    const newVal = !role[key]
    try {
      const { data } = await api.patch(`/users/roles/${role.id}/`, { [key]: newVal })
      onUpdate(data)
    } finally { setSaving(null) }
  }

  const saveName = async () => {
    if (name === role.name) { setEditing(false); return }
    setSaving('name')
    try {
      const { data } = await api.patch(`/users/roles/${role.id}/`, { name })
      onUpdate(data)
      setEditing(false)
    } finally { setSaving(null) }
  }

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4">
      {/* Role header */}
      <div className="flex items-center gap-3 mb-4">
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setName(role.name); setEditing(false) } }}
              autoFocus
              className="flex-1 text-sm font-semibold text-[var(--text)] bg-[var(--bg-main)] border border-[var(--accent)] rounded px-2 py-1 focus:outline-none"
            />
            <button onClick={saveName} disabled={!!saving} className="text-xs bg-[var(--accent)] text-white px-2 py-1 rounded hover:opacity-90 disabled:opacity-50">
              {saving === 'name' ? '...' : t('settings.saveBtn')}
            </button>
            <button onClick={() => { setName(role.name); setEditing(false) }} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text)] px-2 py-1">
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <>
            <span className="font-semibold text-sm text-[var(--text)] flex-1">{role.name}</span>
            <span className="text-[10px] text-[var(--text-secondary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-full">{role.preset}</span>
            <button
              onClick={() => setEditing(true)}
              className="text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors p-1 rounded hover:bg-[var(--bg-hover)]"
              title={t('settings.rename')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Permissions toggles */}
      <div className="space-y-2.5">
        {PERM_KEYS.map(({ key, tKey, icon }) => {
          const label = t(tKey)
          const val = role[key] as boolean
          const isSaving = saving === String(key)
          return (
            <div key={String(key)} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm">{icon}</span>
                <span className={`text-sm ${val ? 'text-[var(--text)]' : 'text-[var(--text-secondary)]'}`}>{label}</span>
              </div>
              <div className="flex items-center gap-2">
                {isSaving && <div className="w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />}
                <Toggle value={val} onChange={() => togglePerm(key)} disabled={!!saving} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddRole, setShowAddRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  const [creatingRole, setCreatingRole] = useState(false)
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

  const handleUpdateRole = (updated: Role) => {
    setRoles(prev => prev.map(r => r.id === updated.id ? updated : r))
  }

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return
    setCreatingRole(true)
    try {
      const { data } = await api.post('/users/roles/', { name: newRoleName.trim(), preset: 'viewer' })
      setRoles(prev => [...prev, data])
      setNewRoleName('')
      setShowAddRole(false)
    } finally { setCreatingRole(false) }
  }

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
    <div className="max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold text-[var(--text)]">{t('nav.settings')}</h1>

      {/* ── Roles & Permissions ── */}
      <section>
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border)]">
          <h2 className="text-base font-semibold text-[var(--text)]">{t('settings.rolesTitle')}</h2>
          <button
            onClick={() => setShowAddRole(v => !v)}
            className="text-sm bg-[var(--accent)] text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
          >
            {t('settings.addRole')}
          </button>
        </div>

        {showAddRole && (
          <div className="mb-4 flex gap-2">
            <input
              value={newRoleName}
              onChange={e => setNewRoleName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateRole() }}
              placeholder={t('settings.newRolePlaceholder')}
              autoFocus
              className="flex-1 text-sm border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
            />
            <button onClick={handleCreateRole} disabled={creatingRole || !newRoleName.trim()}
              className="text-sm bg-[var(--accent)] text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50">
              {creatingRole ? '...' : t('settings.createRole')}
            </button>
            <button onClick={() => { setShowAddRole(false); setNewRoleName('') }}
              className="text-sm border border-[var(--border)] text-[var(--text-secondary)] px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)]">
              {t('common.cancel')}
            </button>
          </div>
        )}

        <div className="space-y-3">
          {roles.length === 0 && <p className="text-sm text-[var(--text-secondary)]">{t('common.noData')}</p>}
          {roles.map(role => (
            <RoleCard key={role.id} role={role} onUpdate={handleUpdateRole} />
          ))}
        </div>

        <p className="mt-3 text-xs text-[var(--text-secondary)]">
          {t('settings.hint')}
        </p>
      </section>

      {/* ── Users ── */}
      <section>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3 pb-2 border-b border-[var(--border)]">
          {t('settings.usersTitle')} ({users.length})
        </h2>
        <div className="space-y-2">
          {users.length === 0 && <p className="text-sm text-[var(--text-secondary)]">{t('settings.noUsers')}</p>}
          {users.map(u => (
            <div key={u.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[var(--accent)]/15 flex items-center justify-center text-xs font-bold text-[var(--accent)] shrink-0">
                {(u.full_name || u.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text)] truncate">{u.full_name || u.email}</div>
                <div className="text-xs text-[var(--text-secondary)] truncate">{u.email}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {savingUserRole === u.id && <div className="w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />}
                <select
                  value={userRole[u.id] ?? ''}
                  onChange={e => handleChangeUserRole(u.id, e.target.value)}
                  className="text-xs border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] rounded px-2 py-1 focus:outline-none focus:border-[var(--accent)] max-w-[140px]"
                >
                  <option value="">{t('settings.noRole')}</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
                <span className={`w-2 h-2 rounded-full shrink-0 ${u.is_active ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`} title={u.is_active ? t('settings.active') : t('settings.inactive')} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Quick Links ── */}
      <section>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3 pb-2 border-b border-[var(--border)]">
          {t('settings.configTitle', 'Настройки системы')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/settings/pipelines"
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--accent)] transition-colors"
          >
            <div className="text-sm font-medium text-[var(--text)]">Воронки продаж</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">Управление пайплайнами и стадиями</div>
          </Link>
          <Link
            to="/settings/dictionaries"
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--accent)] transition-colors"
          >
            <div className="text-sm font-medium text-[var(--text)]">Справочники</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">Источники, причины отказа</div>
          </Link>
          <Link
            to="/settings/custom-fields"
            className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--accent)] transition-colors"
          >
            <div className="text-sm font-medium text-[var(--text)]">Кастомные поля</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">Дополнительные поля для сущностей</div>
          </Link>
        </div>
      </section>

      {/* ── Webhooks ── */}
      <section>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3 pb-2 border-b border-[var(--border)]">Webhooks & Интеграции</h2>
        <WebhooksSection />
      </section>

      {/* ── System ── */}
      <section>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3 pb-2 border-b border-[var(--border)]">{t('settings.systemTitle')}</h2>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">{t('settings.version')}</span>
            <span className="text-[var(--text)] font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-secondary)]">{t('settings.stack')}</span>
            <span className="text-[var(--text)]">Django 5 + React 19</span>
          </div>
        </div>
      </section>
    </div>
  )
}
