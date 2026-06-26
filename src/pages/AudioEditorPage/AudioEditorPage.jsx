import {useState, useRef, useCallback, useEffect, memo} from 'react'
import {
  Upload, Scissors, Play, Pause, Square, Download,
  Undo2, Trash2, AudioWaveform, Clipboard,
  ClipboardPaste, ChevronUp, ChevronDown, ZoomIn, ZoomOut,
  Volume2, VolumeX,
} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Slider} from '@/components/ui/slider'
import {Label} from '@/components/ui/label'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {cn} from '@/lib/utils'
import {parseAlw, parseWav, pcmToAudioBuffer, encodeWav, encodeAlwBytes} from './wavUtils'
import {
  normalizeBuffer, concatBuffers, extractBuffer, cutBuffer,
  insertBuffer, insertSilence, TARGET_SAMPLE_RATE,
} from './audioOps'

// ─── Constants & tiny helpers ────────────────────────────────────────────────

const CLIP_HEIGHT = 100
const UNDO_MAX    = 20
const BG          = '#0f172a'
const PALETTE = [
  '#22c55e','#3b82f6','#f59e0b','#ec4899',
  '#8b5cf6','#06b6d4','#ef4444','#84cc16',
  '#f97316','#14b8a6',
]
let _colorIdx = 0
let _clipSeq  = 0
const nextColor = () => PALETTE[_colorIdx++ % PALETTE.length]
const genId    = () => `c${++_clipSeq}`

function fmt(s) {
  if (!isFinite(s) || s < 0) return '0:00.00'
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`
}

function totalDur(clips)  { return clips.reduce((a, c) => a + c.buffer.duration, 0) }

function mergedOffset(clips, clipId) {
  let off = 0
  for (const c of clips) { if (c.id === clipId) return off; off += c.buffer.length }
  return 0
}

function playPos(clips, mergedSample) {
  let off = 0
  for (const c of clips) {
    const local = mergedSample - off
    if (local <= c.buffer.length) return {clipId: c.id, sample: Math.max(0, local)}
    off += c.buffer.length
  }
  const last = clips.at(-1)
  return last ? {clipId: last.id, sample: last.buffer.length} : {clipId: null, sample: 0}
}

function buildMerged(clips) {
  if (!clips.length) return null
  let buf = clips[0].buffer
  for (let i = 1; i < clips.length; i++) buf = concatBuffers(buf, clips[i].buffer)
  return buf
}

// ─── Time ruler ──────────────────────────────────────────────────────────────

function rulerInterval(pxPerSec) {
  const targetSecs = 80 / Math.max(pxPerSec, 0.001)
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  return steps.find(s => s >= targetSecs) ?? 600
}

// totalSecs: how many seconds are visible across the full canvas width
// pxPerSec: pixels per second (for tick placement)
// variant: 'top' (ticks down, labels below) | 'bottom' (ticks up, labels above)
// triangleRef: optional ref for a playhead indicator triangle (moved via DOM, no re-render)
function TimeRuler({totalSecs, pxPerSec, variant = 'top', triangleRef}) {
  const interval = rulerInterval(pxPerSec)

  // Sub-tick levels: [divisor, height_px]
  // Each level renders only its ODD multiples (i += 2 starting at i=1),
  // so it never overlaps with coarser levels.
  // Sub-tick levels: [divisor, height_px, opacity]
  const subLevels = [
    [2,  11, 0.50],   // half
    [4,   9, 0.35],   // quarter
    [8,   7, 0.25],   // eighth
    [16,  5, 0.18],   // sixteenth
    [32,  4, 0.12],   // thirty-second
  ]

  const subTicks = []
  subLevels.forEach(([div, h, op], li) => {
    const step = interval / div
    for (let i = 1; i * step <= totalSecs + 0.001; i += 2)
      subTicks.push({px: Math.round(i * step * pxPerSec), h, op, key: `${li}-${i}`})
  })

  const majorTicks = []
  for (let i = 0; i * interval <= totalSecs + 0.001; i++)
    majorTicks.push(Math.round(i * interval * 1000) / 1000)

  const isBottom = variant === 'bottom'
  const edge = isBottom ? {bottom: 0} : {top: 0}

  return (
    <div
      className={cn(
        'relative select-none overflow-hidden bg-muted/20',
        isBottom ? 'border-t border-border' : 'border-b border-border',
      )}
      style={{height: 32}}
    >
      {subTicks.map(({px, h, op, key}) => (
        <div
          key={key}
          className="absolute w-px bg-muted-foreground"
          style={{left: px, height: h, opacity: op, ...edge}}
        />
      ))}
      {majorTicks.map(t => {
        const px = Math.round(t * pxPerSec)
        return (
          <div
            key={t}
            className="absolute flex"
            style={{left: px, flexDirection: isBottom ? 'column-reverse' : 'column', ...edge}}
          >
            <div className="h-3.5 w-px bg-muted-foreground/70" />
            <span
              className="ml-1 text-[11px] leading-none text-muted-foreground"
              style={{marginTop: isBottom ? undefined : 2, marginBottom: isBottom ? 2 : undefined}}
            >
              {fmt(t)}
            </span>
          </div>
        )
      })}
      {/* Playhead triangle — positioned via DOM ref to avoid re-renders during playback */}
      {triangleRef && (
        <div
          ref={triangleRef}
          className="pointer-events-none absolute z-20 -translate-x-1/2"
          style={{display: 'none', left: 0, ...edge}}
        >
          <div className={cn(
            'h-0 w-0',
            isBottom
              ? 'border-x-[5px] border-b-[7px] border-x-transparent border-b-amber-400'
              : 'border-x-[5px] border-t-[7px] border-x-transparent border-t-amber-400',
          )} />
        </div>
      )}
    </div>
  )
}

// ─── Canvas drawing ───────────────────────────────────────────────────────────

// visSamples: how many audio samples map to the full canvas width.
// Shorter clips only fill (clip.length / visSamples) of the canvas; the rest is dark background.
// This keeps the layout fixed — the canvas never expands beyond its CSS width.
function drawCanvas(canvas, clip, localCursor, localSel, localPlayhead, visSamples) {
  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height
  if (!W || !H) return

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  const buf  = clip.buffer
  const vis  = Math.max(1, visSamples ?? buf.length)
  const spx  = vis / W                                        // samples per pixel
  const drawW = Math.min(W, Math.ceil(buf.length / spx))     // pixels this clip occupies
  const numCh = Math.min(buf.numberOfChannels, 2)

  for (let ch = 0; ch < numCh; ch++) {
    const chH = H / numCh
    const mid = ch * chH + chH / 2
    const hh  = chH / 2
    ctx.fillStyle = clip.color
    const data = buf.getChannelData(ch)
    for (let x = 0; x < drawW; x++) {
      const s0 = Math.floor(x * spx)
      const s1 = Math.min(buf.length, Math.max(s0 + 1, Math.floor((x + 1) * spx)))
      let mn = 0, mx = 0
      for (let i = s0; i < s1; i++) {
        if (data[i] < mn) mn = data[i]
        if (data[i] > mx) mx = data[i]
      }
      ctx.fillRect(x, mid - mx * hh, 1, Math.max(1, (mx - mn) * hh))
    }
  }

  const s2x = (s) => Math.round((s / vis) * W)

  if (localSel && localSel.end > localSel.start) {
    const x0 = s2x(localSel.start)
    const x1 = s2x(localSel.end)
    ctx.fillStyle = 'rgba(96,165,250,0.45)'
    ctx.fillRect(x0, 0, x1 - x0, H)
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, H); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, H); ctx.stroke()
  }

}

// ─── ClipRow component ───────────────────────────────────────────────────────

const ClipRow = memo(function ClipRow({
  clip, index, totalClips, visSamples, isFocused,
  onRegister, onUnregister, onNeedRedraw,
  onMouseDown, onMouseMove, onMouseUp,
  onMoveUp, onMoveDown, onDelete, onRename,
}) {
  const canvasRef   = useRef(null)
  const inputRef    = useRef(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName]   = useState(clip.name)

  useEffect(() => { setEditName(clip.name) }, [clip.name])

  useEffect(() => {
    if (isEditing) inputRef.current?.select()
  }, [isEditing])

  const commitRename = () => {
    setIsEditing(false)
    const name = editName.trim()
    if (name && name !== clip.name) onRename(clip.id, name)
    else setEditName(clip.name)
  }

  // Register canvas with parent so drawAll can reach it
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    onRegister(clip.id, canvas)
    return () => onUnregister(clip.id)
  }, [clip.id, onRegister, onUnregister])

  // Canvas fills its CSS parent; observe the parent for size changes.
  // The parent is always containerWidth-constrained (no minWidth expansion),
  // so parent.clientWidth is stable — no circular feedback here.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    const resize = () => {
      canvas.width  = parent.clientWidth
      canvas.height = CLIP_HEIGHT
      onNeedRedraw()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [clip.id, onNeedRedraw])

  const getX = (e) => e.clientX - canvasRef.current.getBoundingClientRect().left

  return (
    <div className={cn(
      'overflow-hidden rounded-lg border transition-colors duration-150',
      isFocused ? 'border-primary ring-1 ring-primary' : 'border-border',
    )}>
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{background: clip.color}} />

        {isEditing ? (
          <input
            ref={inputRef}
            className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none border-b border-primary"
            value={editName}
            onChange={e => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitRename() }
              if (e.key === 'Escape') { setIsEditing(false); setEditName(clip.name) }
            }}
          />
        ) : (
          <span
            className="min-w-0 flex-1 cursor-text truncate text-xs font-medium"
            title={`${clip.name} — подвійне клацання для перейменування`}
            onDoubleClick={() => setIsEditing(true)}
          >{editName}</span>
        )}

        <span className="shrink-0 text-xs text-muted-foreground" style={{fontFeatureSettings: '"tnum"'}}>
          {fmt(clip.buffer.duration)}
        </span>
        <button onClick={onMoveUp} disabled={index === 0}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent disabled:opacity-25"
          title="Вгору"><ChevronUp className="h-3.5 w-3.5" /></button>
        <button onClick={onMoveDown} disabled={index === totalClips - 1}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent disabled:opacity-25"
          title="Вниз"><ChevronDown className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete}
          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
          title="Видалити доріжку"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>

      <div style={{background: BG, minHeight: CLIP_HEIGHT}}>
        <canvas
          ref={canvasRef}
          style={{display: 'block', width: '100%', cursor: 'crosshair'}}
          onMouseDown={e => onMouseDown(clip.id, getX(e), canvasRef.current.width, visSamples)}
          onMouseMove={e => onMouseMove(clip.id, getX(e), canvasRef.current.width, visSamples)}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
      </div>
    </div>
  )
})

// ─── AudioEditorPage ─────────────────────────────────────────────────────────

export default function AudioEditorPage() {
  const [clips, setClips]               = useState([])
  const [cursorClipId, setCursorClipId] = useState(null)
  const [cursorSample, setCursorSample] = useState(0)
  const [selection, setSelection]       = useState(null)
  const [clipboard, setClipboard]       = useState(null)
  const [undoStack, setUndoStack]       = useState([])
  const [status, setStatus]             = useState('Імпортуйте WAV або ALW файли або перетягніть їх сюди.')
  const [isPlaying, setIsPlaying]       = useState(false)
  const [silenceSecs, setSilenceSecs]   = useState('1')
  const [containerWidth, setContainerWidth] = useState(800)
  const [zoom, setZoom]                 = useState(1)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [saveOpen, setSaveOpen]         = useState(false)
  const [volume, setVolume]             = useState(1)
  const [muted, setMuted]               = useState(false)

  const clipsRef      = useRef([])
  const cursorRef     = useRef({clipId: null, sample: 0})
  const selectionRef  = useRef(null)
  const clipboardRef  = useRef(null)
  const undoStackRef  = useRef([])
  const isPlayingRef  = useRef(false)
  const canvasMap     = useRef(new Map())
  const audioCtxRef   = useRef(null)
  const sourceRef     = useRef(null)
  const playStartRef  = useRef(0)
  const playOffsetRef = useRef(0)
  const playPosRef   = useRef(0)
  const animRef       = useRef(null)
  const manualStopRef = useRef(false)
  const fileInputRef  = useRef(null)
  const isDragRef     = useRef(false)
  const dragStartRef  = useRef(0)
  const dragClipRef   = useRef(null)
  const handlerRefs        = useRef({})
  const trackListRef       = useRef(null)
  const saveRef            = useRef(null)
  const visSamplesRef      = useRef(44100)  // updated every render; read by stable callbacks
  const containerWidthRef  = useRef(800)    // updated every render; read by RAF tick
  const volumeRef          = useRef(1)      // updated every render; read by getGain
  const mutedRef           = useRef(false)  // updated every render; read by getGain
  const gainRef            = useRef(null)   // Web Audio GainNode, recreated if context resets
  const playOverlayRef     = useRef(null)   // amber line spanning all tracks
  const playTopTriRef      = useRef(null)   // ▼ triangle on top ruler
  const playBotTriRef      = useRef(null)   // ▲ triangle on bottom ruler
  const selStartOverlayRef = useRef(null)   // left edge of selection, spans rulers + tracks
  const selEndOverlayRef   = useRef(null)   // right edge of selection, spans rulers + tracks
  const cursorOverlayRef   = useRef(null)   // cursor position, spans rulers + tracks

  // Sync refs ← state
  useEffect(() => { clipsRef.current     = clips     }, [clips])
  useEffect(() => { selectionRef.current = selection }, [selection])
  useEffect(() => { clipboardRef.current = clipboard }, [clipboard])
  useEffect(() => { undoStackRef.current = undoStack }, [undoStack])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => {
    cursorRef.current = {clipId: cursorClipId, sample: cursorSample}
  }, [cursorClipId, cursorSample])

  // Measure container width — this is the ONLY element we resize-observe.
  // Canvas widths come from their own CSS parent (which fills this container),
  // so there is no circular path back to containerWidth.
  useEffect(() => {
    const el = trackListRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth))
    setContainerWidth(el.clientWidth)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!saveOpen) return
    const close = (e) => {
      if (saveRef.current && !saveRef.current.contains(e.target)) setSaveOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [saveOpen])

  // ── Derived values ─────────────────────────────────────────────────────────

  const dur    = totalDur(clips)
  const maxDur = clips.length ? Math.max(...clips.map(c => c.buffer.duration)) : 0

  // visibleSamples: how many audio samples fit across the full canvas width at current zoom.
  // zoom=1 → all of maxDur is visible; zoom=2 → first half is visible at 2× detail; etc.
  const visibleSamples = clips.length
    ? Math.max(1, Math.round(maxDur / zoom * TARGET_SAMPLE_RATE))
    : TARGET_SAMPLE_RATE

  // pxPerSec is purely for the TimeRuler tick positions — never used for canvas sizing.
  const pxPerSec = containerWidth / Math.max(maxDur / zoom, 0.001)

  visSamplesRef.current     = visibleSamples
  containerWidthRef.current = containerWidth
  volumeRef.current         = volume
  mutedRef.current          = muted

  // ── Audio context ──────────────────────────────────────────────────────────

  const getCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed')
      audioCtxRef.current = new AudioContext()
    return audioCtxRef.current
  }

  const getGain = () => {
    const ctx = getCtx()
    if (!gainRef.current || gainRef.current.context !== ctx) {
      gainRef.current = ctx.createGain()
      gainRef.current.gain.value = mutedRef.current ? 0 : volumeRef.current
      gainRef.current.connect(ctx.destination)
    }
    return gainRef.current
  }

  // ── Canvas registration ────────────────────────────────────────────────────

  const onRegister   = useCallback((id, canvas) => {
    canvasMap.current.set(id, canvas)
    handlerRefs.current.drawClip?.(id)
  }, [])
  const onUnregister = useCallback((id) => { canvasMap.current.delete(id) }, [])

  // ── Drawing ────────────────────────────────────────────────────────────────

  const drawClip = useCallback((clipId) => {
    const canvas = canvasMap.current.get(clipId)
    const clip   = clipsRef.current.find(c => c.id === clipId)
    if (!canvas || !clip || !canvas.width) return

    const sel = selectionRef.current
    const cur = cursorRef.current
    const ph  = playPosRef.current

    const localCursor = cur.clipId === clipId ? cur.sample : null
    const localSel    = (sel?.clipId === clipId && sel.end > sel.start) ? sel : null

    let localPlayhead = null
    if (isPlayingRef.current) {
      let off = 0
      for (const c of clipsRef.current) {
        if (c.id === clipId) {
          const local = ph - off
          if (local >= 0 && local <= c.buffer.length) localPlayhead = local
          break
        }
        off += c.buffer.length
      }
    }

    drawCanvas(canvas, clip, localCursor, localSel, localPlayhead, visSamplesRef.current)
  }, [])

  const drawAll = useCallback(() => {
    for (const c of clipsRef.current) drawClip(c.id)
  }, [drawClip])

  handlerRefs.current.drawClip = drawClip
  handlerRefs.current.drawAll  = drawAll

  useEffect(() => {
    if (!isPlaying) drawAll()
  }, [clips, cursorClipId, cursorSample, selection, isPlaying, drawAll])

  useEffect(() => { drawAll() }, [visibleSamples, drawAll])

  // Keep cursor overlay in sync with cursor position + zoom + container width
  useEffect(() => {
    const el = cursorOverlayRef.current
    if (!el) return
    if (!cursorClipId) { el.style.display = 'none'; return }
    const px = Math.round((cursorSample / visibleSamples) * containerWidth)
    el.style.left    = px + 'px'
    el.style.display = 'block'
  }, [cursorClipId, cursorSample, visibleSamples, containerWidth])

  // Keep selection edge overlays in sync with selection state + zoom + container width
  useEffect(() => {
    const startEl = selStartOverlayRef.current
    const endEl   = selEndOverlayRef.current
    if (!startEl || !endEl) return
    if (!selection || selection.end <= selection.start) {
      startEl.style.display = 'none'
      endEl.style.display   = 'none'
      return
    }
    const x0 = Math.round((selection.start / visibleSamples) * containerWidth)
    const x1 = Math.round((selection.end   / visibleSamples) * containerWidth)
    startEl.style.left    = x0 + 'px'
    startEl.style.display = 'block'
    endEl.style.left      = x1 + 'px'
    endEl.style.display   = 'block'
  }, [selection, visibleSamples, containerWidth])

  // ── Undo ───────────────────────────────────────────────────────────────────

  const pushUndo = useCallback(() => {
    setUndoStack(prev => [...prev.slice(-UNDO_MAX + 1), clipsRef.current])
  }, [])

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current
    if (!stack.length) return
    const prev = stack[stack.length - 1]
    setUndoStack(s => s.slice(0, -1))
    setClips(prev)
    setCursorClipId(null); setCursorSample(0); setSelection(null)
    setStatus('Скасовано.')
  }, [])

  // ── Import ─────────────────────────────────────────────────────────────────

  const decodeFile = useCallback(async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['wav', 'alw'].includes(ext)) throw new Error(`Непідтримуваний формат: .${ext}`)
    const ab  = await file.arrayBuffer()
    const ctx = getCtx()
    if (ext === 'alw') {
      const {pcm, sampleRate, numChannels} = parseAlw(ab)
      return pcmToAudioBuffer(pcm, sampleRate, numChannels, TARGET_SAMPLE_RATE)
    }
    try {
      return await ctx.decodeAudioData(ab.slice(0))
    } catch {
      const {pcm, sampleRate, numChannels} = parseWav(ab)
      return pcmToAudioBuffer(pcm, sampleRate, numChannels, TARGET_SAMPLE_RATE)
    }
  }, [])

  const importFiles = useCallback(async (files) => {
    if (!files.length) return
    setIsDraggingOver(false)
    setStatus(`Завантаження ${files.length === 1 ? files[0].name : `${files.length} файлів`}…`)
    const existing = clipsRef.current
    const targetCh = existing[0]?.buffer.numberOfChannels ?? null
    const newClips = []
    let ch = targetCh
    for (const file of files) {
      try {
        let buf = await decodeFile(file)
        if (!ch) ch = buf.numberOfChannels
        buf = await normalizeBuffer(buf, ch)
        newClips.push({id: genId(), name: file.name, color: nextColor(), buffer: buf})
      } catch (err) {
        setStatus(`Помилка: ${err.message}`); return
      }
    }
    pushUndo()
    const next = [...existing, ...newClips]
    setClips(next)
    setStatus(
      newClips.length === 1
        ? `Завантажено ${files[0].name} — ${fmt(newClips[0].buffer.duration)}`
        : `Завантажено ${newClips.length} файлів — разом ${fmt(totalDur(next))}`
    )
  }, [decodeFile, pushUndo])

  const handleFileChange = (e) => { importFiles(Array.from(e.target.files)); e.target.value = '' }

  // ── Zoom ───────────────────────────────────────────────────────────────────

  const handleZoomIn  = useCallback(() => setZoom(z => Math.min(z * 2, 32)), [])
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z / 2, 1)),  [])

  const handleVolumeChange = useCallback(([v]) => {
    const val = v / 100
    setVolume(val)
    setMuted(false)
    if (gainRef.current) gainRef.current.gain.value = val
  }, [])

  const handleToggleMute = useCallback(() => {
    setMuted(m => {
      const next = !m
      if (gainRef.current) gainRef.current.gain.value = next ? 0 : volumeRef.current
      return next
    })
  }, [])

  // ── Playback ───────────────────────────────────────────────────────────────

  const cancelAnim = () => {
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null }
  }

  const hidePlayheadOverlay = () => {
    if (playOverlayRef.current)  playOverlayRef.current.style.display = 'none'
    if (playTopTriRef.current)   playTopTriRef.current.style.display  = 'none'
    if (playBotTriRef.current)   playBotTriRef.current.style.display  = 'none'
  }

  const pausePlayback = useCallback(() => {
    manualStopRef.current = true
    if (sourceRef.current) { try { sourceRef.current.stop() } catch {} sourceRef.current = null }
    cancelAnim()
    hidePlayheadOverlay()
    const pos = playPos(clipsRef.current, playPosRef.current)
    setCursorClipId(pos.clipId); setCursorSample(pos.sample)
    cursorRef.current = {clipId: pos.clipId, sample: pos.sample}
    setIsPlaying(false); drawAll()
  }, [drawAll])

  const stopAndReset = useCallback(() => {
    manualStopRef.current = true
    if (sourceRef.current) { try { sourceRef.current.stop() } catch {} sourceRef.current = null }
    cancelAnim()
    hidePlayheadOverlay()
    playPosRef.current = 0
    const firstId = clipsRef.current[0]?.id ?? null
    setCursorClipId(firstId); setCursorSample(0)
    cursorRef.current = {clipId: firstId, sample: 0}
    setIsPlaying(false); drawAll()
  }, [drawAll])

  const startPlayback = useCallback(() => {
    const clips = clipsRef.current
    if (!clips.length) return
    const merged = buildMerged(clips)
    if (!merged) return
    const audioCtx = getCtx()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const cur   = cursorRef.current
    const start = cur.clipId ? mergedOffset(clips, cur.clipId) + cur.sample : 0
    // If a clip is focused, stop playback at the end of that clip (don't bleed into the next one)
    const focusedClip = cur.clipId ? clips.find(c => c.id === cur.clipId) : null
    const remaining   = focusedClip ? Math.max(0, focusedClip.buffer.length - cur.sample) : null
    const src = audioCtx.createBufferSource()
    src.buffer = merged; src.connect(getGain())
    if (remaining) src.start(0, start / TARGET_SAMPLE_RATE, remaining / TARGET_SAMPLE_RATE)
    else           src.start(0, start / TARGET_SAMPLE_RATE)
    src.onended = () => {
      if (manualStopRef.current) { manualStopRef.current = false; return }
      cancelAnim()
      if (playOverlayRef.current)  playOverlayRef.current.style.display = 'none'
      if (playTopTriRef.current)   playTopTriRef.current.style.display  = 'none'
      if (playBotTriRef.current)   playBotTriRef.current.style.display  = 'none'
      playPosRef.current = 0
      const returnId = cur.clipId ?? clipsRef.current[0]?.id ?? null
      setCursorClipId(returnId); setCursorSample(cur.sample)
      cursorRef.current = {clipId: returnId, sample: cur.sample}
      setIsPlaying(false); sourceRef.current = null
      handlerRefs.current.drawAll?.()
    }
    sourceRef.current = src
    playStartRef.current  = audioCtx.currentTime
    playOffsetRef.current = start
    playPosRef.current   = start
    setIsPlaying(true)
    if (playOverlayRef.current)  playOverlayRef.current.style.display = 'block'
    if (playTopTriRef.current)   playTopTriRef.current.style.display  = 'block'
    if (playBotTriRef.current)   playBotTriRef.current.style.display  = 'block'
    const tick = () => {
      const ctx = audioCtxRef.current
      if (!ctx) return
      playPosRef.current = playOffsetRef.current +
        Math.round((ctx.currentTime - playStartRef.current) * TARGET_SAMPLE_RATE)
      // Compute local sample position within the currently-playing clip
      const ph = playPosRef.current
      const allClips = clipsRef.current
      let off = 0, localPh = 0
      for (const c of allClips) {
        const local = ph - off
        if (local <= c.buffer.length) { localPh = Math.max(0, local); break }
        off += c.buffer.length
      }
      const px = Math.round((localPh / Math.max(1, visSamplesRef.current)) * containerWidthRef.current)
      if (playOverlayRef.current)  playOverlayRef.current.style.left = px + 'px'
      if (playTopTriRef.current)   playTopTriRef.current.style.left  = px + 'px'
      if (playBotTriRef.current)   playBotTriRef.current.style.left  = px + 'px'
      handlerRefs.current.drawAll?.()
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }, [])

  // ── Edit operations ────────────────────────────────────────────────────────

  const handleDeleteClip = useCallback((clipId) => {
    pushUndo()
    setClips(prev => prev.filter(c => c.id !== clipId))
    if (cursorRef.current.clipId === clipId) { setCursorClipId(null); setCursorSample(0) }
    if (selectionRef.current?.clipId === clipId) setSelection(null)
  }, [pushUndo])

  const handleMoveUp = useCallback((index) => {
    pushUndo()
    setClips(prev => { const n = [...prev]; [n[index-1], n[index]] = [n[index], n[index-1]]; return n })
  }, [pushUndo])

  const handleMoveDown = useCallback((index) => {
    pushUndo()
    setClips(prev => { const n = [...prev]; [n[index], n[index+1]] = [n[index+1], n[index]]; return n })
  }, [pushUndo])

  const handleRename = useCallback((clipId, newName) => {
    setClips(prev => prev.map(c => c.id === clipId ? {...c, name: newName} : c))
  }, [])

  const handleCut = useCallback(() => {
    const sel = selectionRef.current
    if (!sel || sel.end <= sel.start) { setStatus('Спочатку виділіть ділянку.'); return }
    const clip = clipsRef.current.find(c => c.id === sel.clipId)
    if (!clip) return
    const extracted = extractBuffer(clip.buffer, sel.start, sel.end)
    clipboardRef.current = {buffer: extracted, color: clip.color, name: clip.name}
    setClipboard({buffer: extracted, color: clip.color, name: clip.name})
    const newBuffer = cutBuffer(clip.buffer, sel.start, sel.end)
    pushUndo()
    if (!newBuffer) {
      setClips(prev => prev.filter(c => c.id !== clip.id))
      setCursorClipId(null); setCursorSample(0)
    } else {
      setClips(prev => prev.map(c => c.id === clip.id ? {...c, buffer: newBuffer} : c))
      setCursorClipId(clip.id); setCursorSample(sel.start)
    }
    setSelection(null)
    setStatus(`Вирізано ${fmt((sel.end - sel.start) / TARGET_SAMPLE_RATE)} → буфер.`)
  }, [pushUndo])

  const handleCopy = useCallback(() => {
    const sel = selectionRef.current
    if (!sel || sel.end <= sel.start) { setStatus('Спочатку виділіть ділянку.'); return }
    const clip = clipsRef.current.find(c => c.id === sel.clipId)
    if (!clip) return
    const cb = {buffer: extractBuffer(clip.buffer, sel.start, sel.end), color: clip.color, name: clip.name}
    clipboardRef.current = cb; setClipboard(cb)
    setStatus(`Скопійовано ${fmt((sel.end - sel.start) / TARGET_SAMPLE_RATE)} до буфера.`)
  }, [])

  const handlePaste = useCallback(() => {
    const cb  = clipboardRef.current
    const cur = cursorRef.current
    if (!cb)         { setStatus('Буфер обміну порожній.'); return }
    if (!cur.clipId) { setStatus('Клацніть на доріжку, щоб встановити позицію вставки.'); return }
    const clip = clipsRef.current.find(c => c.id === cur.clipId)
    if (!clip) return
    pushUndo()
    setClips(prev => prev.map(c =>
      c.id === clip.id ? {...c, buffer: insertBuffer(clip.buffer, cur.sample, cb.buffer)} : c
    ))
    setCursorSample(cur.sample + cb.buffer.length)
    setStatus(`Вставлено ${fmt(cb.buffer.duration)}.`)
  }, [pushUndo])

  const handleInsertSilence = useCallback(() => {
    const clips = clipsRef.current
    if (!clips.length) { setStatus('Спочатку імпортуйте аудіо.'); return }
    const secs = parseFloat(handlerRefs.current.silenceSecs ?? '1')
    if (!isFinite(secs) || secs <= 0) { setStatus('Введіть позитивне значення секунд.'); return }
    const silSamples = Math.round(secs * TARGET_SAMPLE_RATE)
    const cur = cursorRef.current
    pushUndo()
    if (!cur.clipId) {
      const last = clips[clips.length - 1]
      setClips(prev => prev.map(c =>
        c.id === last.id ? {...c, buffer: insertSilence(last.buffer, last.buffer.length, silSamples)} : c
      ))
      setStatus(`Додано ${secs}с тиші.`); return
    }
    const clip = clips.find(c => c.id === cur.clipId)
    if (!clip) return
    setClips(prev => prev.map(c =>
      c.id === clip.id ? {...c, buffer: insertSilence(clip.buffer, cur.sample, silSamples)} : c
    ))
    setCursorSample(cur.sample + silSamples)
    setStatus(`Вставлено ${secs}с тиші.`)
  }, [pushUndo])

  const handleExportWav = useCallback(() => {
    const clips = clipsRef.current
    if (!clips.length) { setStatus('Немає чого експортувати.'); return }
    const merged = buildMerged(clips)
    if (!merged) return
    const blob = encodeWav(merged)
    const url  = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'audio_export.wav'; a.click()
    URL.revokeObjectURL(url)
    setStatus(`Експортовано audio_export.wav — ${fmt(merged.duration)}`)
  }, [])

  const handleExportAlw = useCallback(async () => {
    const clips = clipsRef.current
    if (!clips.length) { setStatus('Немає чого експортувати.'); return }
    setStatus('Кодування ALW…')
    try {
      const merged = buildMerged(clips)
      if (!merged) return
      const outLen = Math.ceil(merged.duration * 8000)
      const offCtx = new OfflineAudioContext(1, outLen, 8000)
      const src = offCtx.createBufferSource()
      src.buffer = merged; src.connect(offCtx.destination); src.start(0)
      const mono8k = await offCtx.startRendering()
      const blob = encodeAlwBytes(mono8k)
      const url  = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = 'audio_export.alw'; a.click()
      URL.revokeObjectURL(url)
      setStatus(`Експортовано audio_export.alw — ${fmt(mono8k.duration)} @ 8 кГц моно`)
    } catch (err) {
      setStatus(`Помилка експорту: ${err.message}`)
    }
  }, [])

  const handleSaveClipWav = useCallback(() => {
    const clip = clipsRef.current.find(c => c.id === cursorRef.current.clipId)
    if (!clip) return
    const blob = encodeWav(clip.buffer)
    const url  = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = clip.name.replace(/\.[^.]+$/, '') + '.wav'; a.click()
    URL.revokeObjectURL(url)
    setStatus(`Збережено «${clip.name}» як .wav`)
  }, [])

  const handleSaveClipAlw = useCallback(async () => {
    const clip = clipsRef.current.find(c => c.id === cursorRef.current.clipId)
    if (!clip) return
    setStatus('Кодування ALW…')
    try {
      const outLen = Math.ceil(clip.buffer.duration * 8000)
      const offCtx = new OfflineAudioContext(1, outLen, 8000)
      const src = offCtx.createBufferSource()
      src.buffer = clip.buffer; src.connect(offCtx.destination); src.start(0)
      const mono8k = await offCtx.startRendering()
      const blob = encodeAlwBytes(mono8k)
      const url  = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = clip.name.replace(/\.[^.]+$/, '') + '.alw'; a.click()
      URL.revokeObjectURL(url)
      setStatus(`Збережено «${clip.name}» як .alw @ 8 кГц моно`)
    } catch (err) {
      setStatus(`Помилка збереження: ${err.message}`)
    }
  }, [])

  const handleSelectAll = useCallback(() => {
    const clips = clipsRef.current
    if (!clips.length) return
    const targetId = cursorRef.current.clipId ?? clips[0].id
    const clip = clips.find(c => c.id === targetId)
    if (!clip) return
    const sel = {clipId: clip.id, start: 0, end: clip.buffer.length}
    selectionRef.current = sel; setSelection(sel)
    setCursorClipId(clip.id)
    setStatus(`Виділено всю доріжку «${clip.name}».`)
  }, [])

  const handleClear = useCallback(() => {
    stopAndReset(); pushUndo()
    setClips([]); setCursorClipId(null); setCursorSample(0)
    setSelection(null); setClipboard(null); setZoom(1)
    setStatus('Очищено.')
  }, [stopAndReset, pushUndo])

  // ── Canvas mouse events ────────────────────────────────────────────────────

  const onMouseDown = useCallback((clipId, x, canvasW, visSamples) => {
    const clip = clipsRef.current.find(c => c.id === clipId)
    if (!clip) return
    isDragRef.current    = true
    dragStartRef.current = x
    dragClipRef.current  = clipId
    const sample = Math.max(0, Math.min(clip.buffer.length,
      Math.round((x / canvasW) * visSamples)))
    cursorRef.current = {clipId, sample}
    setCursorClipId(clipId); setCursorSample(sample)
    selectionRef.current = null; setSelection(null)
  }, [])

  const onMouseMove = useCallback((clipId, x, canvasW, visSamples) => {
    if (!isDragRef.current || dragClipRef.current !== clipId) return
    const clip = clipsRef.current.find(c => c.id === clipId)
    if (!clip || Math.abs(x - dragStartRef.current) < 3) return
    const a = Math.round((dragStartRef.current / canvasW) * visSamples)
    const b = Math.round((x / canvasW) * visSamples)
    const sel = {
      clipId,
      start: Math.max(0, Math.min(a, b)),
      end:   Math.min(clip.buffer.length, Math.max(a, b)),
    }
    selectionRef.current = sel; setSelection(sel)
    drawClip(clipId)
  }, [drawClip])

  const onMouseUp = useCallback(() => { isDragRef.current = false; dragClipRef.current = null }, [])

  handlerRefs.current.silenceSecs = silenceSecs

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        if (isPlayingRef.current) handlerRefs.current.pausePlayback?.()
        else handlerRefs.current.startPlayback?.()
      }
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        const step = Math.round(0.01 * TARGET_SAMPLE_RATE) // 10 ms
        const right = e.code === 'ArrowRight'
        const sel = selectionRef.current
        if (sel && sel.end > sel.start) {
          // shift selection
          e.preventDefault()
          const clip = clipsRef.current.find(c => c.id === sel.clipId)
          if (!clip) return
          const selLen   = sel.end - sel.start
          const newStart = right
            ? Math.min(sel.start + step, clip.buffer.length - selLen)
            : Math.max(sel.start - step, 0)
          const newSel = {clipId: sel.clipId, start: newStart, end: newStart + selLen}
          selectionRef.current = newSel
          setSelection(newSel)
        } else {
          // shift cursor
          const cur = cursorRef.current
          if (!cur.clipId) return
          e.preventDefault()
          const clip = clipsRef.current.find(c => c.id === cur.clipId)
          if (!clip) return
          const newSample = right
            ? Math.min(cur.sample + step, clip.buffer.length)
            : Math.max(cur.sample - step, 0)
          cursorRef.current = {clipId: cur.clipId, sample: newSample}
          setCursorSample(newSample)
        }
      }
      if (e.code === 'Escape') {
        if (selectionRef.current) { selectionRef.current = null; setSelection(null) }
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.code === 'KeyX') { e.preventDefault(); handlerRefs.current.handleCut?.() }
        if (e.code === 'KeyC') { e.preventDefault(); handlerRefs.current.handleCopy?.() }
        if (e.code === 'KeyV') { e.preventDefault(); handlerRefs.current.handlePaste?.() }
        if (e.code === 'KeyZ') { e.preventDefault(); handlerRefs.current.handleUndo?.() }
        if (e.code === 'KeyA') { e.preventDefault(); handlerRefs.current.handleSelectAll?.() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  handlerRefs.current.pausePlayback   = pausePlayback
  handlerRefs.current.startPlayback   = startPlayback
  handlerRefs.current.handleCut       = handleCut
  handlerRefs.current.handleCopy      = handleCopy
  handlerRefs.current.handlePaste     = handlePaste
  handlerRefs.current.handleUndo      = handleUndo
  handlerRefs.current.handleSelectAll = handleSelectAll

  useEffect(() => () => {
    cancelAnim()
    if (sourceRef.current) try { sourceRef.current.stop() } catch {}
    audioCtxRef.current?.close()
  }, [])

  // ─── Render ────────────────────────────────────────────────────────────────

  const hasSel        = !!(selection && selection.end > selection.start)
  const cursorTimeSec = cursorClipId ? cursorSample / TARGET_SAMPLE_RATE : null

  return (
    <div
      className="flex h-full flex-col p-4 md:p-6"
      onDragOver={e => { e.preventDefault(); setIsDraggingOver(true) }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDraggingOver(false) }}
      onDrop={e => { e.preventDefault(); importFiles(Array.from(e.dataTransfer.files)) }}
    >
      <Card className={cn(
        'flex flex-col border-none shadow-xl transition-shadow duration-150',
        isDraggingOver && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
      )}>
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex items-center gap-3 text-2xl font-bold">
            <AudioWaveform className="h-7 w-7 text-primary" />
            Аудіоредактор
          </CardTitle>
          <CardDescription>
            Редактор WAV / A-law — вирізати · копіювати · вставити · переставити · експортувати
          </CardDescription>
        </CardHeader>

        <CardContent className="mt-4 flex flex-col gap-4">

          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".wav,.alw" multiple className="hidden"
              onChange={handleFileChange} />

            <Button variant="outline" size="sm" onClick={() => fileInputRef.current.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />Імпорт
            </Button>

            <span className="h-5 w-px bg-border" />

            <Button variant="outline" size="sm"
              onClick={() => isPlaying ? pausePlayback() : startPlayback()}
              disabled={!clips.length}>
              {isPlaying
                ? <><Pause className="mr-1.5 h-3.5 w-3.5" />Пауза</>
                : <><Play  className="mr-1.5 h-3.5 w-3.5" />Відтворити</>}
            </Button>
            <Button variant="outline" size="sm" onClick={stopAndReset} disabled={!isPlaying}>
              <Square className="mr-1.5 h-3.5 w-3.5" />Стоп
            </Button>

            <span className="h-5 w-px bg-border" />

            <Button variant="outline" size="sm" onClick={handleCut}  disabled={!hasSel} title="Ctrl+X">
              <Scissors className="mr-1.5 h-3.5 w-3.5" />Вирізати
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!hasSel} title="Ctrl+C">
              <Clipboard className="mr-1.5 h-3.5 w-3.5" />Копіювати
            </Button>
            <Button
              variant={clipboard ? 'default' : 'outline'} size="sm"
              onClick={handlePaste} disabled={!clipboard || !cursorClipId} title="Ctrl+V">
              <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />Вставити
            </Button>

            <span className="h-5 w-px bg-border" />

            <div className="flex items-center gap-1.5">
              <Label htmlFor="sil" className="whitespace-nowrap text-xs">Тиша (с):</Label>
              <Input
                id="sil" type="number" min="0.01" step="0.1"
                value={silenceSecs} onChange={e => setSilenceSecs(e.target.value)}
                className="h-8 w-20 text-xs"
              />
              <Button variant="outline" size="sm" onClick={handleInsertSilence} disabled={!clips.length}>
                Вставити
              </Button>
            </div>

            <span className="h-5 w-px bg-border" />

            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={handleZoomOut} disabled={!clips.length || zoom <= 1} title="Зменшити масштаб">
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="w-9 text-center text-xs tabular-nums text-muted-foreground">
                {zoom < 1 ? `1/${Math.round(1/zoom)}` : `${zoom}×`}
              </span>
              <Button variant="outline" size="icon" className="h-7 w-7"
                onClick={handleZoomIn} disabled={!clips.length || zoom >= 32} title="Збільшити масштаб">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>

            <span className="h-5 w-px bg-border" />

            <div className="flex items-center gap-2" title={`Гучність: ${Math.round(volume * 100)}%`}>
              <button
                onClick={handleToggleMute}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title={muted ? 'Увімкнути звук' : 'Вимкнути звук'}
              >
                {muted || volume === 0
                  ? <VolumeX className="h-3.5 w-3.5" />
                  : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <Slider
                min={0} max={100} step={1}
                value={[Math.round(volume * 100)]}
                onValueChange={handleVolumeChange}
                className="w-24"
              />
              <span className="w-8 text-xs text-muted-foreground" style={{fontFeatureSettings: '"tnum"'}}>
                {Math.round(volume * 100)}%
              </span>
            </div>

            <span className="h-5 w-px bg-border" />

            <div className="relative" ref={saveRef}>
              <Button variant="outline" size="sm"
                onClick={() => setSaveOpen(v => !v)} disabled={!cursorClipId}>
                <Download className="mr-1.5 h-3.5 w-3.5" />Зберегти обрану доріжку
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
              {saveOpen && (
                <div className="absolute top-full left-0 z-50 mt-1 min-w-32.5 rounded-md border border-border bg-popover py-1 shadow-md">
                  <button className="block w-full px-3 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={() => { handleSaveClipWav(); setSaveOpen(false) }}>Зберегти .wav</button>
                  <button className="block w-full px-3 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={() => { handleSaveClipAlw(); setSaveOpen(false) }}>Зберегти .alw (8 кГц)</button>
                </div>
              )}
            </div>

            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8"
                onClick={handleUndo} disabled={!undoStack.length}
                title={`Скасувати (Ctrl+Z)${undoStack.length ? ` · ${undoStack.length}` : ''}`}>
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8"
                onClick={handleClear} disabled={!clips.length} title="Очистити все">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* ── Track list ───────────────────────────────────────────────── */}
          {/* min-w-0 prevents this flex-item from expanding past CardContent's width */}
          <div ref={trackListRef} className="min-w-0">
            {clips.length === 0 ? (
              <div className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-16 text-center text-muted-foreground transition-colors',
                isDraggingOver ? 'border-primary bg-primary/5' : 'border-border',
              )}>
                <AudioWaveform className={cn('h-10 w-10 transition-opacity', isDraggingOver ? 'opacity-60' : 'opacity-25')} />
                <p className="text-sm">
                  {isDraggingOver
                    ? 'Відпустіть, щоб додати файли'
                    : <>Перетягніть WAV або ALW файли сюди або натисніть <strong>Імпорт</strong></>}
                </p>
                {!isDraggingOver && <p className="text-xs opacity-60">Кожен файл стає окремою доріжкою</p>}
              </div>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                {/* Single relative wrapper so all overlays can span both rulers + all tracks */}
                <div className="relative">
                  <TimeRuler totalSecs={maxDur / zoom} pxPerSec={pxPerSec} triangleRef={playTopTriRef} />
                  {/* Playhead — amber, spans rulers + tracks */}
                  <div
                    ref={playOverlayRef}
                    className="pointer-events-none absolute inset-y-0 z-20 w-px bg-amber-400"
                    style={{display: 'none', left: 0}}
                  />
                  {/* Cursor — bright white, spans rulers + tracks */}
                  <div
                    ref={cursorOverlayRef}
                    className="pointer-events-none absolute inset-y-0 z-10 w-px bg-white"
                    style={{display: 'none', left: 0}}
                  />
                  {/* Selection edge lines — blue 1px, span rulers + tracks */}
                  <div
                    ref={selStartOverlayRef}
                    className="pointer-events-none absolute inset-y-0 z-10 w-px bg-blue-500"
                    style={{display: 'none', left: 0}}
                  />
                  <div
                    ref={selEndOverlayRef}
                    className="pointer-events-none absolute inset-y-0 z-10 w-px bg-blue-500"
                    style={{display: 'none', left: 0}}
                  />
                  <div className="flex flex-col gap-px overflow-y-auto" style={{maxHeight: '55vh'}}>
                    {clips.map((clip, index) => (
                      <ClipRow
                        key={clip.id}
                        clip={clip}
                        index={index}
                        totalClips={clips.length}
                        visSamples={visibleSamples}
                        isFocused={clip.id === cursorClipId}
                        onRegister={onRegister}
                        onUnregister={onUnregister}
                        onNeedRedraw={drawAll}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMoveUp={() => handleMoveUp(index)}
                        onMoveDown={() => handleMoveDown(index)}
                        onDelete={() => handleDeleteClip(clip.id)}
                        onRename={handleRename}
                      />
                    ))}
                  </div>
                  <TimeRuler totalSecs={maxDur / zoom} pxPerSec={pxPerSec} variant="bottom" triangleRef={playBotTriRef} />
                </div>
              </div>
            )}
          </div>

          {/* ── Status bar ───────────────────────────────────────────────── */}
          <div className={cn(
            'flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground',
            clips.length === 0 && 'hidden',
          )}>
            <span>{status}</span>
            <div className="flex items-center gap-3 tabular-nums">
              {cursorTimeSec !== null && (
                <span title="Позиція курсору">↱ {fmt(cursorTimeSec)}</span>
              )}
              {clipboard && (
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-400">
                  ✦ буфер: {fmt(clipboard.buffer.duration)}
                </span>
              )}
              {hasSel && (
                <span>вид.: {fmt((selection.end - selection.start) / TARGET_SAMPLE_RATE)}</span>
              )}
              <span>{clips.length} {clips.length === 1 ? 'доріжка' : 'доріжок'} · {fmt(dur)}</span>
            </div>
          </div>
          {clips.length === 0 && <p className="text-xs text-muted-foreground">{status}</p>}

        </CardContent>
      </Card>
    </div>
  )
}
