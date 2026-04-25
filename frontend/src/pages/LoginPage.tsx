import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore, BYPASS_AUTH } from '../stores/authStore'

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // In bypass mode: auto-redirect to dashboard immediately
  useEffect(() => {
    if (BYPASS_AUTH) {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate])

  if (BYPASS_AUTH) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login({ email, password })
      navigate('/dashboard')
    } catch {
      setError(t('auth.loginError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-main)]">
      <div className="w-full max-w-sm bg-[var(--bg-card)] rounded-[20px] shadow-[var(--shadow-md)] p-8">
        <div className="mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-[var(--accent)] flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <span className="font-bold text-2xl text-[var(--text)]">Studio CRM</span>
        </div>
        <h1 className="text-lg font-semibold text-[var(--text)] mb-6 text-center">
          {t('auth.loginTitle')}
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              {t('auth.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-[var(--bg-hover)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-secondary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-[var(--bg-hover)] border border-[var(--border)] rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-secondary)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
          </div>
          {error && (
            <p className="text-sm text-[var(--danger)] text-center">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-semibold text-sm px-4 py-2.5 rounded-[var(--radius-md)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Входим...' : t('auth.login')}
          </button>
        </form>
      </div>
    </div>
  )
}
