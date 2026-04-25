import { useRef, useState } from 'react'
import { clientsApi } from '../../api/clients'

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

interface ImportResult {
  created: number
  errors: { row: number; reason: string }[]
  preview: unknown[]
  total_rows: number
  dry_run: boolean
}

export default function CsvImportModal({ open, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)

  const runPreview = async () => {
    if (!file) return
    setLoading(true)
    try {
      const r = await clientsApi.importCsv(file, true)
      setPreview(r)
    } finally {
      setLoading(false)
    }
  }

  const runImport = async () => {
    if (!file) return
    setLoading(true)
    try {
      const r = await clientsApi.importCsv(file, false)
      setPreview(r)
      if (r.created > 0) {
        onImported()
      }
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">Импорт клиентов из CSV</h3>
            <p className="text-xs text-[var(--text-secondary)]">Колонки: name / industry / country / website / status / company_size / budget_range / description</p>
          </div>
          <button onClick={onClose} className="ml-auto w-7 h-7 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: 'auto' }}>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null) }}
            className="block w-full text-sm text-[var(--text)]"
          />
          {file && !preview && (
            <button onClick={runPreview} disabled={loading} className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)]">
              {loading ? 'Анализ...' : 'Предпросмотр'}
            </button>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="text-sm text-[var(--text)]">
                {preview.dry_run ? 'Предпросмотр' : 'Импорт завершён'}: строк для импорта — <b>{preview.total_rows}</b>,
                ошибок — <b className={preview.errors.length ? 'text-red-500' : 'text-green-500'}>{preview.errors.length}</b>
                {!preview.dry_run && <>, создано: <b className="text-green-500">{preview.created}</b></>}
              </div>
              {preview.errors.length > 0 && (
                <details className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs">
                  <summary className="cursor-pointer text-red-500 font-medium">Ошибки ({preview.errors.length})</summary>
                  <ul className="mt-2 space-y-1 text-[var(--text)]">
                    {preview.errors.slice(0, 20).map((e, i) => (
                      <li key={i}>Строка {e.row}: {e.reason}</li>
                    ))}
                  </ul>
                </details>
              )}
              {preview.dry_run && preview.preview.length > 0 && (
                <details className="rounded-lg border border-[var(--border)] p-3 text-xs" open>
                  <summary className="cursor-pointer text-[var(--text)] font-medium">Первые {Math.min(20, preview.preview.length)} строк</summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words text-[10px] text-[var(--text-secondary)]">
                    {JSON.stringify(preview.preview, null, 2)}
                  </pre>
                </details>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={reset} className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)]">Сбросить</button>
                {preview.dry_run && preview.total_rows > 0 && (
                  <button onClick={runImport} disabled={loading} className="px-4 py-1.5 text-sm rounded-lg text-white bg-[var(--accent)] hover:opacity-90 disabled:opacity-50">
                    {loading ? 'Импорт...' : `Импортировать ${preview.total_rows}`}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
