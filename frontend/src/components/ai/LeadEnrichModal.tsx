import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { aiApi, type LeadEnrichResult, type HhCompany } from '../../api/ai'
import { clientsApi, type Client, type Contact } from '../../api/clients'

interface Props {
  open: boolean
  onClose: () => void
  onCreated?: (client: Client) => void
}

export default function LeadEnrichModal({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation()
  const [domain, setDomain] = useState('')
  const [result, setResult] = useState<LeadEnrichResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  // HH search
  const [hhQuery, setHhQuery] = useState('')
  const [hhResults, setHhResults] = useState<HhCompany[]>([])
  const [hhLoading, setHhLoading] = useState(false)

  useEffect(() => {
    if (!hhQuery.trim()) { setHhResults([]); return }
    const t = setTimeout(async () => {
      setHhLoading(true)
      try { setHhResults((await aiApi.hhSearch(hhQuery.trim())).results || []) }
      finally { setHhLoading(false) }
    }, 400)
    return () => clearTimeout(t)
  }, [hhQuery])

  const pickHhCompany = (c: HhCompany) => {
    if (c.domain) {
      setDomain(c.domain)
      setHhQuery(''); setHhResults([])
      // Auto-run enrichment
      setTimeout(() => run(c.domain || ''), 50)
    }
  }

  const run = async (forceDomain?: string) => {
    const d = (forceDomain ?? domain).trim()
    if (!d) return
    setLoading(true)
    setResult(null)
    try {
      const r = await aiApi.leadEnrich(d)
      setResult(r)
    } finally {
      setLoading(false)
    }
  }

  const createClient = async () => {
    const data = result?.enriched
    if (!data) return
    setCreating(true)
    try {
      const techStack = Array.isArray(data.tech_stack) ? data.tech_stack : []
      const sizeMap: Record<string, string> = {
        '1-10': '1-10',
        '11-50': '11-50',
        '51-200': '51-200',
        '200+': '200+',
      }
      const country = Array.isArray(data.countries) && data.countries.length
        ? data.countries.filter((c) => c && c.toLowerCase() !== 'unknown')[0] || ''
        : ''
      const newClient = await clientsApi.create({
        name: data.name || data.domain || domain,
        industry: data.industry || '',
        website: domain.startsWith('http') ? domain : `https://${domain}`,
        country,
        company_size: (sizeMap[data.company_size_estimate ?? ''] ?? '') as Client['company_size'],
        status: 'lead',
        tech_stack: techStack,
        description: data.description || '',
      })

      // Auto-create contacts extracted by AI / regex
      const contacts = (data.contacts || []).filter((c) => c.full_name || c.email || c.phone || c.linkedin)
      for (const c of contacts.slice(0, 10)) {
        const [firstName, ...rest] = (c.full_name || c.email?.split('@')[0] || 'Contact').split(' ')
        const payload: Partial<Contact> = {
          first_name: firstName || 'Contact',
          last_name: rest.join(' '),
          email: c.email || '',
          phone: c.phone || '',
          linkedin: c.linkedin || '',
          position: c.position || '',
          role: c.is_decision_maker ? 'decision_maker' : 'other',
          is_primary: contacts.indexOf(c) === 0,
        }
        try {
          await clientsApi.contacts.create(newClient.id, payload)
        } catch {
          // best-effort — skip failures
        }
      }

      onCreated?.(newClient)
      onClose()
      setDomain('')
      setResult(null)
    } finally {
      setCreating(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-[96vw] max-w-[1600px] h-[92vh] max-h-[92vh] bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)]">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/></svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)]">{t('leadEnrich.title')}</h3>
            <p className="text-xs text-[var(--text-secondary)]">{t('leadEnrich.subtitle')}</p>
          </div>
          <button onClick={onClose} className="ml-auto w-7 h-7 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ margin: 'auto' }}>
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto flex-1">
          {/* HH search — для русских компаний */}
          <div>
            <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">
              {t('leadEnrich.hhLabel')}
            </label>
            <div className="relative">
              <input
                value={hhQuery}
                onChange={(e) => setHhQuery(e.target.value)}
                placeholder={t('leadEnrich.hhPlaceholder')}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
              />
              {hhResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-xl max-h-64 overflow-y-auto">
                  {hhResults.map((c) => (
                    <button
                      key={c.hh_id}
                      type="button"
                      onClick={() => pickHhCompany(c)}
                      disabled={!c.domain}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-hover)] border-b border-[var(--border)] last:border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {c.logo ? (
                        <img src={c.logo} alt="" className="w-7 h-7 rounded object-contain bg-white shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded bg-[var(--bg-hover)] text-[var(--text-secondary)] text-xs flex items-center justify-center shrink-0">
                          {c.name[0]}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-[var(--text)] truncate">{c.name}</div>
                        <div className="text-[10px] text-[var(--text-secondary)] truncate">
                          {c.domain || t('leadEnrich.hhNoSite')} · HH #{c.hh_id}
                        </div>
                      </div>
                      {c.domain && <span className="text-xs text-[var(--accent)]">→</span>}
                    </button>
                  ))}
                </div>
              )}
              {hhLoading && (
                <div className="absolute top-2.5 right-3 text-[var(--text-secondary)]">
                  <div className="w-3 h-3 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)]">
            <div className="flex-1 h-px bg-[var(--border)]" />
            {t('leadEnrich.orDomain')}
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          <div className="flex gap-2">
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') run() }}
              placeholder={t('leadEnrich.domainPlaceholder')}
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={() => run()}
              disabled={loading || !domain.trim()}
              className="px-3 py-2 text-sm text-white bg-[var(--accent)] rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {loading ? t('leadEnrich.analyse') : t('leadEnrich.find')}
            </button>
          </div>

          {result?.error && (
            <div className="text-xs text-red-500 bg-red-500/10 p-3 rounded-lg">{result.error}</div>
          )}

          {result?.enriched && (
            <div className="space-y-2 text-sm">
              {result.enriched.name && <div><b>{t('leadEnrich.name')}:</b> {result.enriched.name}</div>}
              {result.enriched.industry && <div><b>{t('leadEnrich.industry')}:</b> {result.enriched.industry}</div>}
              {result.enriched.description && <div className="text-[var(--text-secondary)]">{result.enriched.description}</div>}
              {result.enriched.company_size_estimate && <div><b>{t('leadEnrich.size')}:</b> {result.enriched.company_size_estimate}</div>}
              {result.enriched.countries && result.enriched.countries.length > 0 && (
                <div><b>{t('leadEnrich.countries')}:</b> {result.enriched.countries.join(', ')}</div>
              )}
              {result.enriched.tech_stack && result.enriched.tech_stack.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <b className="mr-1">{t('leadEnrich.stack')}:</b>
                  {result.enriched.tech_stack.map((t, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--bg-hover)] border border-[var(--border)]">{t}</span>
                  ))}
                </div>
              )}
              {result.enriched.potential_outstaff_fit && (
                <div className="text-xs text-[var(--accent)] bg-[var(--accent)]/10 p-2 rounded-lg">
                  <b>{t('leadEnrich.outstaffFit')}:</b> {result.enriched.potential_outstaff_fit}
                </div>
              )}

              {/* Contacts found */}
              {result.enriched.contacts && result.enriched.contacts.length > 0 && (
                <div className="border-t border-[var(--border)] pt-2 mt-2">
                  <div className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                    {t('leadEnrich.contactsFound', { count: result.enriched.contacts.length })}
                  </div>
                  <div className="space-y-1.5">
                    {result.enriched.contacts.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-hover)]">
                        <div className="flex-1 min-w-0">
                          {(c.full_name || c.position) && (
                            <div className="font-medium text-[var(--text)]">
                              {c.full_name || '—'}{c.position && <span className="text-[var(--text-secondary)] font-normal"> · {c.position}</span>}
                              {c.is_decision_maker && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)]">ЛПР</span>}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[var(--text-secondary)]">
                            {c.email && <span>✉ {c.email}</span>}
                            {c.phone && <span>📞 {c.phone}</span>}
                            {c.linkedin && <a href={c.linkedin} target="_blank" rel="noreferrer" className="text-[var(--accent)] hover:underline">LinkedIn</a>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-2">{t('leadEnrich.autoCreate')}</p>
                </div>
              )}

              {/* Raw signals (verified) */}
              {result.enriched.raw_signals && (
                (result.enriched.raw_signals.emails?.length || result.enriched.raw_signals.phones?.length || result.enriched.raw_signals.social_urls?.length) && (
                  <details className="border-t border-[var(--border)] pt-2 mt-2 text-xs">
                    <summary className="cursor-pointer text-[var(--text-secondary)]">
                      {t('leadEnrich.rawSignals', { pages: result.enriched.scraped_pages?.length ?? 0 })}
                    </summary>
                    <div className="mt-1 space-y-1 text-[var(--text-secondary)]">
                      {result.enriched.raw_signals.emails && result.enriched.raw_signals.emails.length > 0 && (
                        <div><b>{t('leadEnrich.emails')}:</b> {result.enriched.raw_signals.emails.join(', ')}</div>
                      )}
                      {result.enriched.raw_signals.phones && result.enriched.raw_signals.phones.length > 0 && (
                        <div><b>{t('leadEnrich.phones')}:</b> {result.enriched.raw_signals.phones.join(', ')}</div>
                      )}
                      {result.enriched.raw_signals.social_urls && result.enriched.raw_signals.social_urls.length > 0 && (
                        <div className="break-all"><b>{t('leadEnrich.social')}:</b> {result.enriched.raw_signals.social_urls.join(', ')}</div>
                      )}
                    </div>
                  </details>
                )
              )}

              {result.enriched.raw && (
                <pre className="text-[10px] whitespace-pre-wrap break-words bg-[var(--bg-hover)] p-2 rounded">{result.enriched.raw.slice(0, 300)}</pre>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={createClient}
                  disabled={creating}
                  className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {creating
                    ? t('leadEnrich.creating')
                    : ((result.enriched.contacts?.length ?? 0) > 0
                        ? t('leadEnrich.createClientWith', { count: result.enriched.contacts!.length })
                        : t('leadEnrich.createClient'))}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
