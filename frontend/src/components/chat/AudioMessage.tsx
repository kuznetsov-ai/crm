import { useEffect, useRef, useState } from 'react'

interface Props {
  src: string
  fileName?: string
  sizeBytes?: number
}

function fmt(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60).toString().padStart(2, '0')
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

export default function AudioMessage({ src, fileName, sizeBytes }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onLoaded = () => setDuration(a.duration || 0)
    const onTime = () => setCurrent(a.currentTime || 0)
    const onEnd = () => { setPlaying(false); setCurrent(0) }
    a.addEventListener('loadedmetadata', onLoaded)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded)
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnd)
    }
  }, [])

  const toggle = async () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      try { await a.play() } catch { return }
      setPlaying(true)
    } else {
      a.pause()
      setPlaying(false)
    }
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current
    if (!a || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    a.currentTime = pct * duration
  }

  const pct = duration ? (current / duration) * 100 : 0

  return (
    <div className="flex items-center gap-3 py-1 min-w-[200px] max-w-[320px]">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        className="w-9 h-9 rounded-full bg-[var(--accent)] text-white flex items-center justify-center shrink-0 hover:opacity-90"
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="6,4 20,12 6,20" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div
          className="h-2 rounded-full bg-[var(--bg-hover)] cursor-pointer relative overflow-hidden"
          onClick={seek}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setHover(((e.clientX - r.left) / r.width) * 100)
          }}
          onMouseLeave={() => setHover(null)}
        >
          <div
            className="h-full bg-[var(--accent)] rounded-full transition-[width]"
            style={{ width: `${pct}%` }}
          />
          {hover != null && (
            <div
              className="absolute top-0 bottom-0 w-px bg-[var(--text-secondary)] opacity-50"
              style={{ left: `${hover}%` }}
            />
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono mt-1 text-[var(--text-secondary)]">
          <span>{fmt(current)}</span>
          {fileName && <span className="truncate mx-2 max-w-[120px]" title={fileName}>{fileName}</span>}
          <span>{fmt(duration)}</span>
        </div>
        {sizeBytes != null && sizeBytes > 0 && (
          <div className="text-[9px] font-mono text-[var(--text-secondary)] opacity-60">
            {(sizeBytes / 1024).toFixed(1)} KB
          </div>
        )}
      </div>
    </div>
  )
}
