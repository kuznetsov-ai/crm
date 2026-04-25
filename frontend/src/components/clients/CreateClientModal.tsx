import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { clientsApi, type Client } from '../../api/clients'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (client: Client) => void
}

const STATUSES: Client['status'][] = ['lead', 'prospect', 'active', 'paused', 'churned']
const SIZES = ['1-10', '11-50', '51-200', '200+']

export default function CreateClientModal({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [country, setCountry] = useState('')
  const [website, setWebsite] = useState('')
  const [companySize, setCompanySize] = useState('')
  const [status, setStatus] = useState<Client['status']>('lead')
  const [taxId, setTaxId] = useState('')
  const [taxCountry, setTaxCountry] = useState('RU')
  const [dupCheck, setDupCheck] = useState<{ valid: boolean; reason?: string; duplicates: Array<{ id: number; name: string }> } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Debounced dup check
  useEffect(() => {
    if (!taxId.trim()) { setDupCheck(null); return }
    const t = setTimeout(async () => {
      try {
        const r = await clientsApi.checkTaxId(taxId.trim(), taxCountry)
        setDupCheck(r)
      } catch { /* ignore */ }
    }, 400)
    return () => clearTimeout(t)
  }, [taxId, taxCountry])

  useEffect(() => {
    if (!open) {
      setName(''); setIndustry(''); setCountry(''); setWebsite('')
      setCompanySize(''); setStatus('lead'); setTaxId(''); setTaxCountry('RU')
      setDupCheck(null); setError('')
    }
  }, [open])

  const canSubmit = name.trim().length > 0 && (!dupCheck || dupCheck.valid) && !saving

  const submit = async () => {
    setSaving(true)
    setError('')
    try {
      const payload: Partial<Client> = {
        name: name.trim(),
        industry,
        country,
        website,
        company_size: companySize as Client['company_size'],
        status,
        tax_id: taxId.trim(),
        tax_id_country: taxId.trim() ? taxCountry : '',
      }
      const created = await clientsApi.create(payload)
      onCreated(created)
    } catch (err) {
      const msg = (err as { response?: { data?: unknown } })?.response?.data
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const inputCls = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)]'
  const labelCls = 'block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="text-sm font-semibold text-[var(--text)]">{t('createClient.title')}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: 'auto' }}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          <div>
            <label className={labelCls}>{t('createClient.name')}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Company name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('createClient.industry')}</label>
              <input value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputCls} placeholder="Retail" />
            </div>
            <div>
              <label className={labelCls}>{t('createClient.country')}</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls} placeholder="Italy" />
            </div>
            <div>
              <label className={labelCls}>{t('createClient.size')}</label>
              <select value={companySize} onChange={(e) => setCompanySize(e.target.value)} className={inputCls}>
                <option value="">—</option>
                {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('createClient.status')}</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as Client['status'])} className={inputCls}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>{t('createClient.website')}</label>
            <input value={website} onChange={(e) => setWebsite(e.target.value)} className={inputCls} placeholder="https://example.com" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>{t('createClient.inn')}</label>
              <input value={taxId} onChange={(e) => setTaxId(e.target.value)} className={inputCls} placeholder="10 или 12 цифр" />
            </div>
            <div>
              <label className={labelCls}>{t('createClient.innCountry')}</label>
              <select value={taxCountry} onChange={(e) => setTaxCountry(e.target.value)} className={inputCls}>
                <option value="RU">RU</option>
                <option value="BY">BY</option>
                <option value="KZ">KZ</option>
                <option value="AM">AM</option>
              </select>
            </div>
          </div>
          {dupCheck && !dupCheck.valid && (
            <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg p-2">
              ✗ {dupCheck.reason}
            </div>
          )}
          {dupCheck && dupCheck.valid && dupCheck.duplicates.length > 0 && (
            <div className="text-xs text-orange-500 bg-orange-500/10 border border-orange-500/30 rounded-lg p-2">
              ⚠ Возможные дубликаты с таким ИНН: {dupCheck.duplicates.map((d) => d.name).join(', ')}
            </div>
          )}
          {error && (
            <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/30 rounded-lg p-2 break-words">{error}</div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-[var(--border)]">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">{t('createClient.cancel')}</button>
          <button onClick={submit} disabled={!canSubmit} className="px-4 py-1.5 text-sm text-white bg-[var(--accent)] rounded-lg hover:opacity-90 disabled:opacity-50">
            {saving ? t('createClient.creating') : t('createClient.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
