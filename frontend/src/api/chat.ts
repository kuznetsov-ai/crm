import api from './client'

export interface ChatUser {
  id: number
  email: string
  full_name: string
  avatar: string | null
}

export interface ChatReaction {
  id: number
  emoji: string
  user: ChatUser
}

export interface ReplyPreview {
  id: number
  text: string
  author: string
}

export interface MentionInfo {
  id: number
  email: string
  full_name: string
  read: boolean
}

export interface ForwardedFromPreview {
  id: number
  text: string
  author: string
}

export interface ChatMessage {
  id: number
  channel: number
  author: ChatUser | null
  text: string
  reply_to: number | null
  reply_to_preview: ReplyPreview | null
  forwarded_from: number | null
  forwarded_from_preview: ForwardedFromPreview | null
  is_edited: boolean
  reactions: ChatReaction[]
  attachment_url: string | null
  attachment_name: string
  attachment_size: number
  attachment_mime: string
  mentions?: MentionInfo[]
  read_by?: number[]
  created_at: string
  updated_at: string
}

export interface PresenceMember {
  user_id: number
  name: string
  last_seen: string | null
  online: boolean
}

export interface ChatMentionRow {
  id: number
  mentioned_user: { id: number; email: string; full_name: string }
  read: boolean
  created_at: string
}

export interface ChatChannel {
  id: number
  name: string
  channel_type: 'direct' | 'group'
  members: ChatUser[]
  last_message: { text: string; author: string; created_at: string } | null
  unread_count: number
  created_at: string
}

export const chatApi = {
  channels: {
    list: async (): Promise<ChatChannel[]> => {
      const { data } = await api.get('/chat/')
      return Array.isArray(data) ? data : data.results ?? []
    },
    create: async (payload: { name: string; channel_type: string; member_ids: number[] }): Promise<ChatChannel> => {
      const { data } = await api.post('/chat/', payload)
      return data
    },
    direct: async (userId: number): Promise<ChatChannel> => {
      const { data } = await api.post('/chat/direct/', { user_id: userId })
      return data
    },
  },
  messages: {
    list: async (channelId: number): Promise<ChatMessage[]> => {
      const { data } = await api.get(`/chat/${channelId}/messages/`)
      return Array.isArray(data) ? data : data.results ?? []
    },
    sendWithAttachment: async (
      channelId: number,
      text: string,
      file: File,
      replyTo?: number,
    ): Promise<ChatMessage> => {
      const fd = new FormData()
      if (text) fd.append('text', text)
      fd.append('attachment', file)
      if (replyTo) fd.append('reply_to', String(replyTo))
      const { data } = await api.post(`/chat/${channelId}/messages/`, fd)
      return data
    },
    pin: async (messageId: number): Promise<void> => {
      await api.patch(`/chat/messages/${messageId}/pin/`)
    },
    forward: async (messageId: number, targetChannelId: number): Promise<void> => {
      await api.post(`/chat/messages/${messageId}/forward/`, { channel_id: targetChannelId })
    },
    edit: async (messageId: number, text: string): Promise<ChatMessage> => {
      const { data } = await api.patch(`/chat/messages/${messageId}/`, { text })
      return data
    },
    delete: async (messageId: number): Promise<void> => {
      await api.delete(`/chat/messages/${messageId}/`)
    },
    search: async (channelId: number, q: string): Promise<{ results: ChatMessage[]; q: string; count: number }> => {
      const { data } = await api.get(`/chat/${channelId}/search/`, { params: { q } })
      return data
    },
    markRead: async (channelId: number, ids: number[]): Promise<{ ok: boolean; marked: number }> => {
      const { data } = await api.post(`/chat/${channelId}/mark-read/`, { message_ids: ids })
      return data
    },
    media: async (channelId: number, kind: 'all' | 'image' | 'audio' | 'file' = 'all'): Promise<{ results: ChatMessage[]; kind: string; count: number }> => {
      const { data } = await api.get(`/chat/${channelId}/media/`, { params: { kind } })
      return data
    },
    react: async (messageId: number, emoji: string): Promise<{ ok: boolean; action: string }> => {
      const { data } = await api.post(`/chat/messages/${messageId}/react/`, { emoji })
      return data
    },
  },
  presence: {
    list: async (channelId: number): Promise<{ members: PresenceMember[]; now: string }> => {
      const { data } = await api.get(`/chat/${channelId}/presence/`)
      return data
    },
  },
  members: {
    add: async (channelId: number, userIds: number[]): Promise<{ ok: boolean; added: number[] }> => {
      const { data } = await api.post(`/chat/${channelId}/members/`, { user_ids: userIds })
      return data
    },
    remove: async (channelId: number, userId: number): Promise<void> => {
      await api.delete(`/chat/${channelId}/members/${userId}/`)
    },
  },
  mentions: {
    list: async (unreadOnly = false): Promise<ChatMentionRow[]> => {
      const { data } = await api.get('/chat/mentions/', { params: unreadOnly ? { unread: '1' } : {} })
      return Array.isArray(data) ? data : data.results ?? []
    },
    markRead: async (ids: number[]): Promise<void> => {
      await api.post('/chat/mentions/mark-read/', { ids })
    },
  },
}
