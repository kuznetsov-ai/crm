import api from './client'

export type EmailPreset = 'follow_up' | 'reminder' | 'proposal_intro' | 'meeting_request'

export interface SentimentResult {
  sentiment: 'positive' | 'neutral' | 'mixed' | 'negative' | 'at_risk' | string
  score: number
  reason: string
  signals: string[]
  recommended_action: string
  messages_analyzed?: number
  raw?: string
}

export interface NextBestActionItem {
  title: string
  rationale?: string
  impact?: 'high' | 'medium' | 'low'
  entity_type?: string
  entity_id?: number
}

export interface NextBestActionResult {
  actions: NextBestActionItem[]
  pipeline?: { open_deals: number; open_tasks: number; overdue_tasks: number }
  raw?: string
}

export interface EnrichedContact {
  full_name?: string
  position?: string
  email?: string
  phone?: string
  linkedin?: string
  is_decision_maker?: boolean
}

export interface LeadEnrichResult {
  enriched: {
    domain: string
    name?: string
    industry?: string
    description?: string
    company_size_estimate?: string
    countries?: string[]
    tech_stack?: string[]
    products?: string[]
    potential_outstaff_fit?: string
    contacts?: EnrichedContact[]
    primary_email?: string
    primary_phone?: string
    scraped_pages?: string[]
    raw_signals?: {
      emails?: string[]
      phones?: string[]
      linkedin_urls?: string[]
      social_urls?: string[]
    }
    raw?: string
  } | null
  error?: string
}

export interface ResourceMatchResult {
  picks: { user_id: number; name: string; role: string; match_reason: string; skill_overlap: string[] }[]
  raw?: string
}

export interface CandidateMatchResult {
  role?: string
  seniority?: string
  required_skills?: string[]
  nice_to_have?: string[]
  culture_fit?: string
  sourcing_brief?: string
  raw?: string
}

export interface TranscriptResult {
  summary?: string
  decisions?: string[]
  action_items?: { title: string; owner?: string; deadline?: string }[]
  open_questions?: string[]
  sentiment?: string
  saved_note_id?: number | null
  raw?: string
}

export interface BenchRosterResult {
  roster: {
    user_id: number; name: string; email: string; role: string;
    utilization_pct: number; skills: string[]; rolloff_date: string | null;
    current_client: string | null
  }[]
  totals: { count: number; bench_count: number; avg_utilization_pct: number }
}

export interface ProviderInfo { provider: string; model: string }

export interface HhCompany {
  hh_id: string
  name: string
  url: string | null
  domain: string | null
  logo: string | null
  hh_page: string | null
  error?: string
}

export const aiApi = {
  providerInfo: async (): Promise<ProviderInfo> => {
    const { data } = await api.get('/ai/provider/')
    return data
  },
  resourceMatch: async (dealId: number): Promise<ResourceMatchResult> => {
    const { data } = await api.post(`/ai/deals/${dealId}/resource-match/`)
    return data
  },
  candidateMatch: async (clientId: number): Promise<CandidateMatchResult> => {
    const { data } = await api.post(`/ai/clients/${clientId}/candidate-match/`)
    return data
  },
  bench: async (): Promise<BenchRosterResult> => {
    const { data } = await api.get('/ai/bench/')
    return data
  },
  transcript: async (transcript: string, clientId?: number, dealId?: number): Promise<TranscriptResult> => {
    const { data } = await api.post('/ai/transcript/', { transcript, client_id: clientId, deal_id: dealId })
    return data
  },
  dealSummary: async (dealId: number): Promise<{ summary: string; deal_id: number }> => {
    const { data } = await api.post(`/ai/deals/${dealId}/summary/`)
    return data
  },
  draftEmail: async (
    dealId: number,
    preset: EmailPreset,
    tone: string = 'professional',
  ): Promise<{ draft: string; preset: EmailPreset }> => {
    const { data } = await api.post(`/ai/deals/${dealId}/draft-email/`, { preset, tone })
    return data
  },
  chatSentiment: async (channelId: number): Promise<SentimentResult> => {
    const { data } = await api.post(`/ai/chat/${channelId}/sentiment/`)
    return data
  },
  nextBestAction: async (): Promise<NextBestActionResult> => {
    const { data } = await api.post('/ai/next-best-action/')
    return data
  },
  leadEnrich: async (domain: string): Promise<LeadEnrichResult> => {
    const { data } = await api.post('/ai/lead-enrich/', { domain })
    return data
  },
  hhSearch: async (query: string): Promise<{ results: HhCompany[] }> => {
    const { data } = await api.post('/ai/hh-search/', { query })
    return data
  },
}
