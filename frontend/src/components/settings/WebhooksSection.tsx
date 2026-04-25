import { useEffect, useState } from 'react'
import { webhooksApi, WEBHOOK_EVENTS, type WebhookEndpoint, type WebhookDelivery } from '../../api/webhooks'

export default function WebhooksSection() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<Partial<WebhookEndpoint>>({ name: '', url: '', events: [], secret: '', active: true })
  const [saving, setSaving] = useState(false)

  const reload = async () => {
    const [eps, dels] = await Promise.all([webhooksApi.list(), webhooksApi.deliveries().catch(() => [])])
    setEndpoints(eps); setDeliveries(dels)
  }
  useEffect(() => { reload() }, [])

  const submit = async () => {
    if (!form.name?.trim() || !form.url?.trim()) return
    setSaving(true)
    try {
      await webhooksApi.create(form)
      setForm({ name: '', url: '', events: [], secret: '', active: true })
      setShowForm(false)
      await reload()
    } finally { setSaving(false) }
  }

  const toggleActive = async (ep: WebhookEndpoint) => {
    await webhooksApi.update(ep.id, { active: !ep.active })
    await reload()
  }

  const del = async (ep: WebhookEndpoint) => {
    if (!window.confirm(`Удалить webhook "${ep.name}"?`)) return
    await webhooksApi.delete(ep.id)
    await reload()
  }

  const toggleEvent = (ev: string) => {
    setForm((f) => {
      const cur = new Set(f.events ?? [])
      if (cur.has(ev)) cur.delete(ev); else cur.add(ev)
      return { ...f, events: Array.from(cur) }
    })
  }

  const inputCls = 'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text)] text-sm px-3 py-2 focus:outline-none focus:border-[var(--accent)]'
  const labelCls = 'block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--text)]">Webhooks</h2>
          <p className="text-xs text-[var(--text-secondary)]">Отправляют события (deal/client/task) на n8n/Zapier/свой сервер.</p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90">
          {showForm ? 'Закрыть' : '+ Добавить'}
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Название *</label>
              <input value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} placeholder="n8n deal pipeline" />
            </div>
            <div>
              <label className={labelCls}>URL *</label>
              <input value={form.url ?? ''} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} className={inputCls} placeholder="https://n8n.example.com/webhook/..." />
            </div>
          </div>
          <div>
            <label className={labelCls}>Events</label>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((e) => {
                const active = (form.events ?? []).includes(e.value)
                return (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => toggleEvent(e.value)}
                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                      active
                        ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                        : 'text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {e.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className={labelCls}>Secret (опционально)</label>
            <input value={form.secret ?? ''} onChange={(e) => setForm((f) => ({ ...f, secret: e.target.value }))} className={inputCls} placeholder="Для HMAC SHA-256 подписи" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]">Отмена</button>
            <button onClick={submit} disabled={saving || !form.name || !form.url} className="px-3 py-1.5 text-sm bg-[var(--accent)] text-white rounded-lg hover:opacity-90 disabled:opacity-50">
              {saving ? 'Создаём...' : 'Создать'}
            </button>
          </div>
        </div>
      )}

      {endpoints.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] p-8 text-center text-sm text-[var(--text-secondary)]">
          Нет webhooks. Добавьте первый, чтобы получать события о сделках/клиентах/задачах на ваш endpoint.
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-hover)]">
              <tr>
                {['Название', 'URL', 'Events', 'Активен', ''].map((h) => (
                  <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] px-3 py-2">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {endpoints.map((ep) => (
                <tr key={ep.id}>
                  <td className="px-3 py-2 font-medium text-[var(--text)]">{ep.name}</td>
                  <td className="px-3 py-2 text-xs font-mono text-[var(--text-secondary)] break-all max-w-xs">{ep.url}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {ep.events.map((e, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">{e}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={ep.active} onChange={() => toggleActive(ep)} />
                    </label>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => del(ep)} className="text-[var(--text-secondary)] hover:text-[var(--danger)]" title="Удалить">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {deliveries.length > 0 && (
        <details className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium text-[var(--text)]">
            Последние доставки ({deliveries.length})
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[var(--bg-hover)]">
                <tr>
                  {['Когда', 'Event', 'Status', 'Длительность', 'Ошибка'].map((h) => (
                    <th key={h} className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] px-3 py-2">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {deliveries.slice(0, 50).map((d) => (
                  <tr key={d.id}>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{new Date(d.created_at).toLocaleString('ru-RU')}</td>
                    <td className="px-3 py-2 font-mono">{d.event}</td>
                    <td className={`px-3 py-2 font-mono ${d.status_code >= 200 && d.status_code < 300 ? 'text-green-500' : 'text-red-500'}`}>{d.status_code || '—'}</td>
                    <td className="px-3 py-2 text-[var(--text-secondary)]">{d.duration_ms}ms</td>
                    <td className="px-3 py-2 text-red-500 truncate max-w-xs">{d.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  )
}
