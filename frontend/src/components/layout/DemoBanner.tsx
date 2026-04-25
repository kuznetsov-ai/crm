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
    : '—'

  return (
    <>
      <div
        className="w-full bg-[var(--accent-soft,#FEF3C7)] border-b border-[var(--accent,#F97316)] text-[var(--text,#0F172A)] text-xs px-3 py-1.5 flex items-center gap-3 flex-wrap shrink-0"
        role="status"
      >
        <span className="font-semibold">DEMO</span>
        <span className="opacity-80">
          Shared sandbox · resets every {info.reset_interval_hours}h · last reset: {lastReset}
        </span>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={resetting}
          className="ml-auto px-2.5 py-1 rounded font-semibold text-white bg-[var(--accent,#F97316)] hover:opacity-90 disabled:opacity-50 transition-opacity text-xs"
        >
          {resetting ? 'Resetting…' : 'Reset now'}
        </button>
      </div>
      {confirmOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={() => setConfirmOpen(false)}>
          <div className="bg-[var(--bg-card,#FFFFFF)] rounded-xl p-5 max-w-sm w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-2">Reset demo data?</h3>
            <p className="text-sm text-[var(--text-secondary,#64748B)] mb-4">
              This wipes the shared sandbox for everyone and reloads fresh demo data. The page will reload.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-3 py-1.5 rounded text-sm border border-[var(--border,#E2E8F0)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setConfirmOpen(false); handleReset(); }}
                className="px-3 py-1.5 rounded text-sm font-semibold text-white bg-[var(--accent,#F97316)] hover:opacity-90"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
