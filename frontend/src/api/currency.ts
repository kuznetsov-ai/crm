import api from './client'

export interface CurrencyRate {
  base: string
  quote: string
  rate: string   // decimal as string, e.g. '92.350000'
  source: string
  fetched_at: string
}

export interface CurrencySettings {
  currency: 'USD' | 'RUB'
}

export const currencyApi = {
  getRate: async (base = 'USD', quote = 'RUB'): Promise<CurrencyRate | null> => {
    try {
      const { data } = await api.get('/currency/rate/', { params: { base, quote } })
      return data
    } catch {
      return null
    }
  },

  syncRate: async (): Promise<CurrencyRate> => {
    const { data } = await api.post('/currency/rate/sync/')
    return data
  },

  getSettings: async (): Promise<CurrencySettings> => {
    const { data } = await api.get('/currency/settings/')
    return data
  },

  patchSettings: async (currency: 'USD' | 'RUB'): Promise<CurrencySettings> => {
    const { data } = await api.patch('/currency/settings/', { currency })
    return data
  },
}
