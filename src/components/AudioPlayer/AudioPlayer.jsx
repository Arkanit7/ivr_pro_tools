import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
  memo,
} from 'react'
import {Play, Pause, Volume2, VolumeX, Download} from 'lucide-react'
import {cn} from '@/lib/utils'
import {saveAs} from 'file-saver'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PLAYBACK_RATES = [0.75, 1, 1.1, 1.2, 1.3, 1.4, 1.5, 1.75, 2]

const SpeedSelect = memo(function SpeedSelect({value, onChange}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="h-7 w-14 shrink-0 border border-border bg-transparent px-1 text-xs text-muted-foreground shadow-none">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PLAYBACK_RATES.map((r) => (
          <SelectItem key={r} value={String(r)}>
            {r}×
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
})

function fmt(s) {
  if (!isFinite(s) || s < 0) return '0:00'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

// Thin horizontal scrubber bar — used for both progress and volume.
function TrackBar({value, onChange, className}) {
  const barRef = useRef(null)
  const dragging = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  const getRatio = useCallback((clientX) => {
    const rect = barRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }, [])

  // Attach global move/up listeners once; use refs so they stay stable.
  useEffect(() => {
    const onMove = (e) => {
      if (dragging.current) onChangeRef.current(getRatio(e.clientX))
    }
    const onUp = () => {
      dragging.current = false
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [getRatio])

  return (
    <div
      ref={barRef}
      className={cn(
        'group relative flex h-5 cursor-pointer items-center',
        className,
      )}
      onMouseDown={(e) => {
        dragging.current = true
        onChangeRef.current(getRatio(e.clientX))
        e.preventDefault() // prevent text selection while dragging
      }}
    >
      {/* Track track — expands slightly on hover */}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-border transition-[height] duration-100 group-hover:h-1.25">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-foreground/75"
          style={{width: `${value * 100}%`}}
        />
      </div>
      {/* Thumb — visible on hover */}
      <div
        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
        style={{left: `${value * 100}%`}}
      />
    </div>
  )
}

const AudioPlayer = forwardRef(function AudioPlayer(
  {
    src,
    downloadBlob,
    downloadName,
    getDownloadName,
    onEnded,
    onPlayStateChange,
    autoPlay = false,
    className,
  },
  ref,
) {
  const audioRef = useRef(null)

  // Stable refs for callbacks so effects don't need them as deps
  const autoPlayRef = useRef(autoPlay)
  const onEndedRef = useRef(onEnded)
  const onPlayStateChangeRef = useRef(onPlayStateChange)
  autoPlayRef.current = autoPlay
  onEndedRef.current = onEnded
  onPlayStateChangeRef.current = onPlayStateChange

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const playbackRateRef = useRef(1)

  // Expose imperative play/pause for parent pages that need per-item button control
  useImperativeHandle(ref, () => ({
    play: () => audioRef.current?.play().catch(() => {}),
    pause: () => audioRef.current?.pause(),
  }))

  // When src changes: reset state and auto-play if requested
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)
    onPlayStateChangeRef.current?.(false)
    audio.playbackRate = playbackRateRef.current
    if (src && autoPlayRef.current) {
      audio.play().catch(() => {})
    }
  }, [src])

  // Wire native audio events — runs once; callbacks accessed via refs
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlay = () => {
      setIsPlaying(true)
      onPlayStateChangeRef.current?.(true)
    }
    const onPause = () => {
      setIsPlaying(false)
      onPlayStateChangeRef.current?.(false)
    }
    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onDurationChange = () =>
      setDuration(isFinite(audio.duration) ? audio.duration : 0)
    const onEnd = () => {
      setIsPlaying(false)
      setCurrentTime(0)
      onPlayStateChangeRef.current?.(false)
      onEndedRef.current?.()
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('ended', onEnd)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('ended', onEnd)
    }
  }, [])

  const handlePlayPause = () => {
    const audio = audioRef.current
    if (!audio || !src) return
    if (audio.paused) audio.play().catch(() => {})
    else audio.pause()
  }

  const handleSeek = useCallback(
    (ratio) => {
      const audio = audioRef.current
      if (!audio || !duration) return
      const t = ratio * duration
      audio.currentTime = t
      setCurrentTime(t)
    },
    [duration],
  )

  const handleVolume = useCallback((v) => {
    const audio = audioRef.current
    if (audio) {
      audio.volume = v
      audio.muted = false
    }
    setVolume(v)
    setMuted(false)
  }, [])

  const handleMute = () => {
    const audio = audioRef.current
    if (!audio) return
    const next = !muted
    audio.muted = next
    setMuted(next)
  }

  const handlePlaybackRate = useCallback((rate) => {
    playbackRateRef.current = rate
    setPlaybackRate(rate)
    if (audioRef.current) audioRef.current.playbackRate = rate
  }, [])

  const handleDownload = () => {
    const name = getDownloadName ? getDownloadName() : downloadName
    if (downloadBlob && name) saveAs(downloadBlob, name)
  }

  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0
  const disabled = !src

  return (
    <div
      className={cn(
        'flex items-center gap-2.5',
        disabled && 'pointer-events-none opacity-40',
        className,
      )}
    >
      <audio ref={audioRef} src={src || undefined} preload="metadata" />

      {/* Play / Pause */}
      <button
        type="button"
        aria-label={isPlaying ? 'Пауза' : 'Відтворити'}
        onClick={handlePlayPause}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-transform hover:scale-105 active:scale-95"
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
        )}
      </button>

      {/* Current time */}
      <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {fmt(currentTime)}
      </span>

      {/* Progress scrubber */}
      <TrackBar
        value={progress}
        onChange={handleSeek}
        className="min-w-0 flex-1"
      />

      {/* Total time */}
      <span className="w-9 shrink-0 text-xs text-muted-foreground tabular-nums">
        {fmt(duration)}
      </span>

      {/* Mute toggle */}
      <button
        type="button"
        aria-label={muted ? 'Увімкнути звук' : 'Вимкнути звук'}
        onClick={handleMute}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
      >
        {muted || volume === 0 ? (
          <VolumeX className="h-4 w-4" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </button>

      {/* Volume scrubber */}
      <TrackBar
        value={muted ? 0 : volume}
        onChange={handleVolume}
        className="w-16 shrink-0"
      />

      {/* Playback speed */}
      <SpeedSelect value={playbackRate} onChange={handlePlaybackRate} />

      {/* Download */}
      {downloadBlob && (downloadName || getDownloadName) && (
        <button
          type="button"
          aria-label={`Завантажити ${downloadName}`}
          title={`Завантажити ${downloadName}`}
          onClick={handleDownload}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
        >
          <Download className="h-4 w-4" />
        </button>
      )}
    </div>
  )
})

export default AudioPlayer
