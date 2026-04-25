import { useEffect, useState } from 'react'
import { demoApi, type DemoInfo } from '../../api/demo'

export default function DemoBanner() {
  const [info, setInfo] = useState<DemoInfo | null>(null)
  const [resetting, setResetting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    demoApi.info().then(setInfo).catch(() => setInfo(null))
  }, [])

  if (!info?.demo_mode) return null

  const handleReset = async () => {
    setResetting(true)
    try {
      await demoApi.reset()
      window.location.reload()
    } catch (e) {
      setResetting(false)
      alert('Reset failed. Please try again in a moment.')
    }
  }

  const lastReset = info.last_reset_iso
    ? new Date(info.last_reset_iso).toLocaleString()
    : null

  return (
    <>
      <div
        className="w-full px-4 py-2 flex items-center gap-3 flex-wrap shrink-0"
        style={{
          background: 'rgba(255, 138, 61, 0.10)',
          borderBottom: '1px solid var(--color-border-eds)',
          color: 'var(--color-text-eds)',
        }}
        role="status"
      >
        <span className="eds-mono-label" style={{ color: 'var(--color-accent-eds)', fontSize: '11px' }}>
          // DEMO
        </span>
        <span className="eds-mono-label" style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '12px', color: 'var(--color-text-eds)' }}>
          shared sandbox{lastReset ? ` · last reset: ${lastReset}` : ''} · click reset to refresh
        </span>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={resetting}
          className="eds-btn eds-btn--primary ml-auto"
          style={{ padding: '4px 12px', fontSize: '10px' }}
        >
          {resetting ? '↻ Resetting' : '→ Reset now'}
        </button>
      </div>
      {confirmOpen && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4" onClick={() => setConfirmOpen(false)}>
          <div
            className="eds-panel eds-panel--accent max-w-sm w-full"
            style={{ background: 'var(--bg-card-solid)', borderColor: 'var(--color-accent-eds)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="eds-mono-label mb-2" style={{ color: 'var(--color-accent-eds)' }}>// confirm.reset</div>
            <h3 className="font-mono text-base mb-2" style={{ color: 'var(--color-text-eds)' }}>Reset demo data?</h3>
            <p className="text-sm font-mono mb-4" style={{ color: 'var(--color-text-dim)' }}>
              Wipes the shared sandbox for everyone and reloads fresh demo data. The page will reload.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="eds-btn eds-btn--ghost"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setConfirmOpen(false); handleReset(); }}
                className="eds-btn eds-btn--primary"
              >
                → Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
