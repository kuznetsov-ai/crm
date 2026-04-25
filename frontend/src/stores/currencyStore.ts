import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { currencyApi } from '../api/currency'

interface CurrencyState {
  currency: 'USD' | 'RUB'
  rate: number | null    // RUB per 1 USD
  rateSource: string | null
  rateDate: string | null
  loaded: boolean
  load: () => Promise<void>
  setCurrency: (c: 'USD' | 'RUB') => Promise<void>
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: 'USD',
      rate: null,
      rateSource: null,
      rateDate: null,
      loaded: false,

      load: async () => {
        try {
          const [settings, rateData] = await Promise.all([
            currencyApi.getSettings(),
            currencyApi.getRate(),
          ])
          set({
            currency: settings.currency,
            rate: rateData ? parseFloat(rateData.rate) : null,
            rateSource: rateData?.source ?? null,
            rateDate: rateData?.fetched_at ?? null,
            loaded: true,
          })
        } catch {
          set({ loaded: true })
        }
      },

      setCurrency: async (c) => {
        set({ currency: c })
        await currencyApi.patchSettings(c)
      },
    }),
    {
      name: 'crm_currency',
      partialize: (s) => ({ currency: s.currency }),
    }
  )
)

/** Format a deal amount based on workspace currency preference. */
export function formatAmount(
  valueUsd: string | number | null | undefined,
  valueRub: string | number | null | undefined,
  currency: 'USD' | 'RUB',
  rate: number | null
): string {
  if (currency === 'RUB') {
    if (valueRub != null && valueRub !== '') {
      return `₽ ${Number(valueRub).toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`
    }
    // fallback: convert on client if rate available
    if (rate != null && valueUsd != null && valueUsd !== '') {
      const rub = Number(valueUsd) * rate
      return `₽ ${rub.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`
    }
  }
  // USD default
  if (valueUsd == null || valueUsd === '') return '—'
  return `$ ${Number(valueUsd).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}
