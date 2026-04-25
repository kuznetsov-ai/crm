import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDictionariesStore } from '../../stores/useDictionariesStore'

interface Props {
  onSubmit: (lostReasonId: number, comment: string) => void
  onCancel: () => void
}

export default function LostReasonModal({ onSubmit, onCancel }: Props) {
  const { t } = useTranslation()
  const { lostReasons, fetchAll } = useDictionariesStore()
  const [selectedId, setSelectedId] = useState<number | ''>('')
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (lostReasons.length === 0) fetchAll()
  }, [])

  const activeLostReasons = lostReasons.filter(r => r.is_active)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedId) return
    onSubmit(Number(selectedId), comment)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="bg-[var(--bg-card)] rounded-2xl shadow-xl p-6 w-full max-w-md mx-4"
        data-testid="lost-reason-modal"
      >
        <h2 className="text-lg font-semibold text-[var(--text)] mb-4">
          {t('dictionaries.lostReasonModal')}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              {t('dictionaries.lostReasonLabel')} *
            </label>
            <select
              value={selectedId}
              onChange={e => setSelectedId(Number(e.target.value) || '')}
              required
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-sm px-3 py-2 outline-none focus:border-[var(--accent)] transition-colors"
              data-testid="lost-reason-select"
            >
              <option value="" disabled>— {t('dictionaries.lostReasonLabel')} —</option>
              {activeLostReasons.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--text-secondary)]">
              {t('dictionaries.lostCommentLabel')}
            </label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              placeholder={t('dictionaries.lostCommentPlaceholder')}
              className="rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)] text-sm px-3 py-2 outline-none focus:border-[var(--accent)] transition-colors resize-none"
              data-testid="lost-reason-comment"
            />
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              {t('dictionaries.cancelLost')}
            </button>
            <button
              type="submit"
              disabled={!selectedId}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {t('dictionaries.submitLost')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
