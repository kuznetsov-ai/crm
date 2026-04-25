import { useTranslation } from 'react-i18next'
import WebhooksSection from '../../components/settings/WebhooksSection'

/** Stub badge for integrations that are planned but not built yet. */
function ComingSoonBadge() {
  return (
    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--bg-hover)] text-[var(--text-secondary)]">
      Coming soon
    </span>
  )
}

export default function IntegrationsPage() {
  const { t } = useTranslation()

  return (
    <div className="space-y-8">
      {/* Webhooks */}
      <section>
        <WebhooksSection />
      </section>

      {/* AI provider info */}
      <section>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3 pb-2 border-b border-[var(--border)]">
          {t('settings.aiProvider', 'AI провайдер')}
        </h2>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-[var(--text)]">DeepSeek / Anthropic Claude</div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                {t('settings.aiProviderDesc', 'AI-функции: анализ сделок, черновики писем, NBA, enrichment. Управляется через переменную DEEPSEEK_API_KEY / ANTHROPIC_API_KEY в .env.')}
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-[var(--success,#22c55e)] shrink-0" title="Configured" />
          </div>
        </div>
      </section>

      {/* Future stubs */}
      <section>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3 pb-2 border-b border-[var(--border)]">
          {t('settings.futureIntegrations', 'Планируемые интеграции')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { name: 'Bitrix24 Import', desc: 'Импорт клиентов и сделок из Bitrix24 CRM' },
            { name: 'HH.ru', desc: 'Поиск кандидатов и управление вакансиями' },
            { name: 'Telegram Notify', desc: 'Уведомления в Telegram при событиях CRM' },
          ].map(item => (
            <div key={item.name} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg p-4 opacity-60">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-medium text-[var(--text)]">{item.name}</span>
                <ComingSoonBadge />
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
