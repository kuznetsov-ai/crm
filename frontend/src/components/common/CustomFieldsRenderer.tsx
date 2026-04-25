import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntityType, CustomFieldValues } from '../../api/customFields'
import { useCustomFieldsStore } from '../../stores/useCustomFieldsStore'

interface Props {
  entity: EntityType
  entityId: number
  values: CustomFieldValues
  onChange: (patch: CustomFieldValues) => void
  readOnly?: boolean
}

export default function CustomFieldsRenderer({
  entity,
  entityId,
  values,
  onChange,
  readOnly = false,
}: Props) {
  const { t } = useTranslation()
  const { defsByEntity, fetchDefs } = useCustomFieldsStore()
  const defs = defsByEntity[entity] ?? []

  useEffect(() => {
    fetchDefs(entity)
  }, [entity, fetchDefs])

  if (defs.length === 0) return null

  function handleChange(code: string, value: unknown) {
    onChange({ [code]: value })
  }

  return (
    <div className="space-y-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)] mb-2">
        {t('customFields.sectionTitle', 'Дополнительно')}
      </h3>
      {defs.map((def) => {
        const raw = values?.[def.code]
        const displayValue = raw !== undefined && raw !== null ? raw : ''

        return (
          <div key={def.code} className="flex flex-col gap-0.5">
            <label className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
              {def.label}
              {def.required && <span className="text-red-500 ml-0.5">*</span>}
            </label>

            {/* String / Text / URL / Email */}
            {(def.type === 'string' || def.type === 'url' || def.type === 'email') && (
              <input
                type={def.type === 'url' ? 'url' : def.type === 'email' ? 'email' : 'text'}
                value={String(displayValue)}
                readOnly={readOnly}
                onChange={(e) => handleChange(def.code, e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
              />
            )}

            {def.type === 'text' && (
              <textarea
                value={String(displayValue)}
                readOnly={readOnly}
                rows={3}
                onChange={(e) => handleChange(def.code, e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none disabled:opacity-50"
              />
            )}

            {/* Number */}
            {def.type === 'number' && (
              <input
                type="number"
                value={displayValue !== '' ? String(displayValue) : ''}
                readOnly={readOnly}
                onChange={(e) => handleChange(def.code, e.target.value !== '' ? e.target.value : null)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
              />
            )}

            {/* Date */}
            {def.type === 'date' && (
              <input
                type="date"
                value={displayValue !== '' ? String(displayValue) : ''}
                readOnly={readOnly}
                onChange={(e) => handleChange(def.code, e.target.value || null)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
              />
            )}

            {/* Datetime */}
            {def.type === 'datetime' && (
              <input
                type="datetime-local"
                value={displayValue !== '' ? String(displayValue).slice(0, 16) : ''}
                readOnly={readOnly}
                onChange={(e) => handleChange(def.code, e.target.value || null)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
              />
            )}

            {/* Boolean */}
            {def.type === 'boolean' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(displayValue)}
                  disabled={readOnly}
                  onChange={(e) => handleChange(def.code, e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)] accent-[var(--accent)]"
                />
                <span className="text-sm text-[var(--text)]">{def.label}</span>
              </label>
            )}

            {/* Enum */}
            {def.type === 'enum' && (
              <select
                value={displayValue !== '' ? String(displayValue) : ''}
                disabled={readOnly}
                onChange={(e) => handleChange(def.code, e.target.value || null)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-50"
              >
                <option value="">{t('customFields.selectOption', '— выберите —')}</option>
                {(def.options ?? []).map((opt) => (
                  <option key={opt.code} value={opt.code}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {/* Multi-enum */}
            {def.type === 'multi_enum' && (
              <div className="flex flex-wrap gap-2">
                {(def.options ?? []).map((opt) => {
                  const selected = Array.isArray(displayValue)
                    ? (displayValue as string[]).includes(opt.code)
                    : false
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      disabled={readOnly}
                      onClick={() => {
                        if (readOnly) return
                        const current = Array.isArray(displayValue)
                          ? (displayValue as string[])
                          : []
                        const next = selected
                          ? current.filter((c) => c !== opt.code)
                          : [...current, opt.code]
                        handleChange(def.code, next)
                      }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                        selected
                          ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                          : 'bg-[var(--surface)] text-[var(--text-secondary)] border-[var(--border)] hover:border-[var(--accent)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            )}

            {def.help_text && (
              <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{def.help_text}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
