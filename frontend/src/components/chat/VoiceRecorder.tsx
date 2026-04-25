import { useEffect, useRef, useState } from 'react'

interface Props {
  onSend: (blob: Blob, durationSec: number) => void
  disabled?: boolean
}

const SUPPORTED_MIME = (() => {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  if (typeof MediaRecorder === 'undefined') return ''
  for (const m of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m
    } catch { /* noop */ }
  }
  return ''
})()

function fmt(sec: number) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function VoiceRecorder({ onSend, disabled }: Props) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [levels, setLevels] = useState<number[]>([])

  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const startedAtRef = useRef<number>(0)
  const tickRef = useRef<number | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => () => cleanup(), [])

  function cleanup() {
    if (recRef.current && recRef.current.state !== 'inactive') {
      try { recRef.current.stop() } catch { /* noop */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    if (tickRef.current != null) {
      cancelAnimationFrame(tickRef.current)
      tickRef.current = null
    }
    recRef.current = null
    analyserRef.current = null
  }

  async function start() {
    setError(null)
    if (!SUPPORTED_MIME) {
      setError('Voice not supported in this browser')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      audioCtxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      analyserRef.current = analyser

      const rec = new MediaRecorder(stream, { mimeType: SUPPORTED_MIME })
      chunksRef.current = []
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data)
      }
      rec.start()
      recRef.current = rec
      startedAtRef.current = Date.now()
      setRecording(true)
      setSeconds(0)
      setLevels([])
      pumpLevel()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
    }
  }

  function pumpLevel() {
    const analyser = analyserRef.current
    if (!analyser) return
    const data = new Uint8Array(analyser.fftSize)
    const tick = () => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128
        sum += v * v
      }
      const rms = Math.sqrt(sum / data.length)
      setLevels((prev) => {
        const next = [...prev, Math.min(1, rms * 3)]
        return next.length > 60 ? next.slice(-60) : next
      })
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000)
      setSeconds(elapsed)
      tickRef.current = requestAnimationFrame(tick)
    }
    tickRef.current = requestAnimationFrame(tick)
  }

  function stopAndSend() {
    const rec = recRef.current
    if (!rec) return
    const dur = Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000))
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: SUPPORTED_MIME.split(';')[0] })
      onSend(blob, dur)
      cleanup()
      setRecording(false)
      setSeconds(0)
      setLevels([])
    }
    try { rec.stop() } catch { cleanup(); setRecording(false) }
  }

  function cancel() {
    cleanup()
    setRecording(false)
    setSeconds(0)
    setLevels([])
  }

  if (error) {
    return (
      <button
        type="button"
        onClick={() => setError(null)}
        className="eds-btn eds-btn--ghost"
        title={error}
      >
        ⚠ {error.slice(0, 40)}
      </button>
    )
  }

  if (!recording) {
    return (
      <button
        type="button"
        onClick={start}
        disabled={disabled || !SUPPORTED_MIME}
        className="w-9 h-9 flex items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-30"
        title={SUPPORTED_MIME ? 'Record voice message' : 'Voice not supported'}
        aria-label="Record voice message"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-[var(--bg-hover)] border border-[var(--accent)]">
      <span className="w-2 h-2 rounded-full bg-[var(--danger,red)] animate-pulse" />
      <span className="font-mono text-xs tabular-nums text-[var(--text)]">{fmt(seconds)}</span>
      <div className="flex items-end gap-[2px] h-5 min-w-[80px] max-w-[120px] overflow-hidden">
        {levels.slice(-30).map((lvl, i) => (
          <span
            key={i}
            style={{
              width: 2,
              height: `${Math.max(2, lvl * 20)}px`,
              background: 'var(--accent)',
              borderRadius: 1,
            }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={cancel}
        className="text-[var(--text-secondary)] hover:text-[var(--danger,red)] px-1"
        title="Cancel"
        aria-label="Cancel recording"
      >
        ✕
      </button>
      <button
        type="button"
        onClick={stopAndSend}
        className="px-2 py-0.5 rounded-full bg-[var(--accent)] text-white text-xs font-semibold hover:opacity-90"
        title="Send voice message"
        aria-label="Send voice message"
      >
        Send →
      </button>
    </div>
  )
}
