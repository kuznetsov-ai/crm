import { useEffect, useRef, useCallback, useState } from 'react'
import type { ChatMessage } from '../api/chat'

interface ReactionResult {
  message_id: number
  emoji: string
  action: string
  user_id: number
}

interface TypingEvent {
  user_id: number
  user_name: string
  is_typing: boolean
}

interface PresenceEvent {
  user_id: number
  user_name: string
  online: boolean
  last_seen: string | null
}

interface MessageReadEvent {
  message_id: number
  user_id: number
  read_at: string
}

type IncomingEvent =
  | { type: 'message'; message: ChatMessage }
  | { type: 'reaction'; result: ReactionResult }
  | { type: 'typing'; user_id: number; user_name: string; is_typing: boolean }
  | { type: 'message_edited'; message: ChatMessage }
  | { type: 'message_deleted'; message_id: number }
  | { type: 'presence'; user_id: number; user_name: string; online: boolean; last_seen: string | null }
  | { type: 'message_read'; message_id: number; user_id: number; read_at: string }

interface UseChatSocketOptions {
  channelId: number | null
  onMessage: (msg: ChatMessage) => void
  onReaction: (result: ReactionResult) => void
  onTyping?: (event: TypingEvent) => void
  onEdited?: (msg: ChatMessage) => void
  onDeleted?: (messageId: number) => void
  onPresence?: (event: PresenceEvent) => void
  onMessageRead?: (event: MessageReadEvent) => void
}

export function useChatSocket({ channelId, onMessage, onReaction, onTyping, onEdited, onDeleted, onPresence, onMessageRead }: UseChatSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelay = useRef(1000)
  const onMessageRef = useRef(onMessage)
  const onReactionRef = useRef(onReaction)
  const onTypingRef = useRef(onTyping)
  const onEditedRef = useRef(onEdited)
  const onDeletedRef = useRef(onDeleted)
  const onPresenceRef = useRef(onPresence)
  const onMessageReadRef = useRef(onMessageRead)

  // Keep refs up to date without triggering reconnect
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])
  useEffect(() => { onReactionRef.current = onReaction }, [onReaction])
  useEffect(() => { onTypingRef.current = onTyping }, [onTyping])
  useEffect(() => { onEditedRef.current = onEdited }, [onEdited])
  useEffect(() => { onDeletedRef.current = onDeleted }, [onDeleted])
  useEffect(() => { onPresenceRef.current = onPresence }, [onPresence])
  useEffect(() => { onMessageReadRef.current = onMessageRead }, [onMessageRead])

  const connect = useCallback(() => {
    if (!channelId) return
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host = window.location.host
    const token = localStorage.getItem('access_token') ?? ''
    const url = `${protocol}://${host}/ws/chat/${channelId}/?token=${token}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      reconnectDelay.current = 1000
    }

    ws.onmessage = (event) => {
      try {
        const data: IncomingEvent = JSON.parse(event.data)
        if (data.type === 'message') onMessageRef.current(data.message)
        else if (data.type === 'reaction') onReactionRef.current(data.result)
        else if (data.type === 'typing') {
          onTypingRef.current?.({
            user_id: data.user_id,
            user_name: data.user_name,
            is_typing: data.is_typing,
          })
        }
        else if (data.type === 'message_edited') onEditedRef.current?.(data.message)
        else if (data.type === 'message_deleted') onDeletedRef.current?.(data.message_id)
        else if (data.type === 'presence') {
          onPresenceRef.current?.({
            user_id: data.user_id,
            user_name: data.user_name,
            online: data.online,
            last_seen: data.last_seen,
          })
        }
        else if (data.type === 'message_read') {
          onMessageReadRef.current?.({
            message_id: data.message_id,
            user_id: data.user_id,
            read_at: data.read_at,
          })
        }
      } catch { /* ignore malformed */ }
    }

    ws.onclose = () => {
      setConnected(false)
      if (reconnectDelay.current <= 30000) {
        reconnectTimer.current = setTimeout(() => {
          reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000)
          connect()
        }, reconnectDelay.current)
      }
    }

    ws.onerror = () => ws.close()
  }, [channelId])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback((text: string, replyTo?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'message', text, reply_to: replyTo }))
    }
  }, [])

  const sendReaction = useCallback((messageId: number, emoji: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reaction', message_id: messageId, emoji }))
    }
  }, [])

  const sendTyping = useCallback((isTyping: boolean) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', is_typing: isTyping }))
    }
  }, [])

  return { connected, sendMessage, sendReaction, sendTyping }
}
