import { useEffect, useRef, useCallback, useState } from 'react'
import type { ChatMessage } from '../api/chat'

interface ReactionResult {
  message_id: number
  emoji: string
  action: string
  user_id: number
}

type IncomingEvent =
  | { type: 'message'; message: ChatMessage }
  | { type: 'reaction'; result: ReactionResult }

interface UseChatSocketOptions {
  channelId: number | null
  onMessage: (msg: ChatMessage) => void
  onReaction: (result: ReactionResult) => void
}

export function useChatSocket({ channelId, onMessage, onReaction }: UseChatSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectDelay = useRef(1000)
  const onMessageRef = useRef(onMessage)
  const onReactionRef = useRef(onReaction)

  // Keep refs up to date without triggering reconnect
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])
  useEffect(() => { onReactionRef.current = onReaction }, [onReaction])

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

  return { connected, sendMessage, sendReaction }
}
