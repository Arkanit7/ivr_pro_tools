import {useState, useRef, useCallback, useEffect} from 'react'
import {
  Upload,
  Scissors,
  Play,
  Pause,
  Square,
  Download,
  Undo2,
  Trash2,
  AudioWaveform,
  Clipboard,
  ClipboardPaste,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Volume2,
  VolumeX,
  Eraser,
} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Slider} from '@/components/ui/slider'
import {Label} from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {cn} from '@/lib/utils'
import {TARGET_SAMPLE_RATE} from './audioOps'
import {fmt, totalDur} from './utils'
import {drawCanvas} from './drawCanvas'
import {TimeRuler} from './TimeRuler'
import {ClipRow} from './ClipRow'
import {usePlayback} from './usePlayback'
import {useEditing} from './useEditing'

export default function AudioEditorPage() {
  const [clips, setClips] = useState([])
  const [cursorClipId, setCursorClipId] = useState(null)
  const [cursorSample, setCursorSample] = useState(0)
  const [selection, setSelection] = useState(null)
  const [clipboard, setClipboard] = useState(null)
  const [undoStack, setUndoStack] = useState([])
  const [status, setStatus] = useState('Імпортуйте WAV або ALW файли або перетягніть їх сюди.')
  const [silenceSecs, setSilenceSecs] = useState('1')
  const [containerWidth, setContainerWidth] = useState(800)
  const [zoom, setZoom] = useState(1)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)

  // Refs that shadow state — updated every render, read by stable callbacks and RAF tick.
  const clipsRef = useRef([])
  const cursorRef = useRef({clipId: null, sample: 0})
  const selectionRef = useRef(null)
  const clipboardRef = useRef(null)
  const undoStackRef = useRef([])
  const silenceSecsRef = useRef('1')
  const visSamplesRef = useRef(44100)
  const containerWidthRef = useRef(800)
  const volumeRef = useRef(1)
  const mutedRef = useRef(false)

  // DOM refs
  const canvasMap = useRef(new Map())
  const fileInputRef = useRef(null)
  const trackListRef = useRef(null)
  const saveRef = useRef(null)
  const handlerRefs = useRef({})

  // Drag-select state
  const isDragRef = useRef(false)
  const dragStartRef = useRef(0)
  const dragClipRef = useRef(null)

  // Overlay refs — rendered in JSX, positioned via DOM during playback/interaction.
  const cursorOverlayRef = useRef(null)
  const selStartOverlayRef = useRef(null)
  const selEndOverlayRef = useRef(null)

  // ── Sync refs ← state ──────────────────────────────────────────────────────
  useEffect(() => { clipsRef.current = clips }, [clips])
  useEffect(() => { selectionRef.current = selection }, [selection])
  useEffect(() => { clipboardRef.current = clipboard }, [clipboard])
  useEffect(() => { undoStackRef.current = undoStack }, [undoStack])
  useEffect(() => { cursorRef.current = {clipId: cursorClipId, sample: cursorSample} }, [cursorClipId, cursorSample])

  // ── Measure container width ────────────────────────────────────────────────
  // This is the only element we resize-observe; canvas widths come from their
  // own CSS parent which fills this container, so there is no circular path.
  useEffect(() => {
    const el = trackListRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth))
    setContainerWidth(el.clientWidth)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Close save dropdown on outside click
  useEffect(() => {
    if (!saveOpen) return
    const close = (e) => {
      if (saveRef.current && !saveRef.current.contains(e.target)) setSaveOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [saveOpen])

  // ── Derived values (updated every render, refs read by stable callbacks) ───
  const dur = totalDur(clips)
  const maxDur = clips.length ? Math.max(...clips.map((c) => c.buffer.duration)) : 0
  const visibleSamples = clips.length
    ? Math.max(1, Math.round((maxDur / zoom) * TARGET_SAMPLE_RATE))
    : TARGET_SAMPLE_RATE
  const pxPerSec = containerWidth / Math.max(maxDur / zoom, 0.001)

  visSamplesRef.current = visibleSamples
  containerWidthRef.current = containerWidth
  volumeRef.current = volume
  mutedRef.current = muted
  silenceSecsRef.current = silenceSecs

  // ── Hooks ──────────────────────────────────────────────────────────────────
  const {
    isPlaying,
    isPlayingRef,
    playPosRef,
    gainRef,
    getCtx,
    startPlayback,
    pausePlayback,
    stopAndReset,
    playOverlayRef,
    playTopTriRef,
    playBotTriRef,
  } = usePlayback({
    clipsRef,
    cursorRef,
    visSamplesRef,
    containerWidthRef,
    volumeRef,
    mutedRef,
    handlerRefs,
    setCursorClipId,
    setCursorSample,
  })

  const {
    pushUndo,
    handleUndo,
    importFiles,
    handleDeleteClip,
    handleMoveUp,
    handleMoveDown,
    handleRename,
    handleRemove,
    handleCut,
    handleCopy,
    handlePaste,
    handleInsertSilence,
    handleSelectAll,
    handleClear,
    handleExportWav,
    handleExportAlw,
    handleSaveClipWav,
    handleSaveClipAlw,
  } = useEditing({
    clipsRef,
    cursorRef,
    selectionRef,
    clipboardRef,
    undoStackRef,
    silenceSecsRef,
    setClips,
    setCursorClipId,
    setCursorSample,
    setSelection,
    setClipboard,
    setUndoStack,
    setStatus,
    setZoom,
    setIsDraggingOver,
    stopAndReset,
    getCtx,
  })

  // ── Canvas registration & drawing ──────────────────────────────────────────
  const onRegister = useCallback((id, canvas) => {
    canvasMap.current.set(id, canvas)
    handlerRefs.current.drawClip?.(id)
  }, [])

  const onUnregister = useCallback((id) => {
    canvasMap.current.delete(id)
  }, [])

  const drawClip = useCallback((clipId) => {
    const canvas = canvasMap.current.get(clipId)
    const clip = clipsRef.current.find((c) => c.id === clipId)
    if (!canvas || !clip || !canvas.width) return
    const sel = selectionRef.current
    const cur = cursorRef.current
    const ph = playPosRef.current
    const localCursor = cur.clipId === clipId ? cur.sample : null
    const localSel = sel?.clipId === clipId && sel.end > sel.start ? sel : null
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
  }, [clipsRef, selectionRef, cursorRef, playPosRef, isPlayingRef, visSamplesRef])

  const drawAll = useCallback(() => {
    for (const c of clipsRef.current) drawClip(c.id)
  }, [drawClip, clipsRef])

  handlerRefs.current.drawClip = drawClip
  handlerRefs.current.drawAll = drawAll

  useEffect(() => {
    if (!isPlaying) drawAll()
  }, [clips, cursorClipId, cursorSample, selection, isPlaying, drawAll])

  useEffect(() => {
    drawAll()
  }, [visibleSamples, drawAll])

  // Sync cursor overlay position with cursor state + zoom + container width
  useEffect(() => {
    const el = cursorOverlayRef.current
    if (!el) return
    if (!cursorClipId) {
      el.style.display = 'none'
      return
    }
    const px = Math.round((cursorSample / visibleSamples) * containerWidth)
    el.style.left = px + 'px'
    el.style.display = 'block'
  }, [cursorClipId, cursorSample, visibleSamples, containerWidth])

  // Sync selection edge overlays with selection state + zoom + container width
  useEffect(() => {
    const startEl = selStartOverlayRef.current
    const endEl = selEndOverlayRef.current
    if (!startEl || !endEl) return
    if (!selection || selection.end <= selection.start) {
      startEl.style.display = 'none'
      endEl.style.display = 'none'
      return
    }
    const x0 = Math.round((selection.start / visibleSamples) * containerWidth)
    const x1 = Math.round((selection.end / visibleSamples) * containerWidth)
    startEl.style.left = x0 + 'px'
    startEl.style.display = 'block'
    endEl.style.left = x1 + 'px'
    endEl.style.display = 'block'
  }, [selection, visibleSamples, containerWidth])

  // ── Canvas mouse events ────────────────────────────────────────────────────
  const onMouseDown = useCallback((clipId, x, canvasW, visSamples) => {
    const clip = clipsRef.current.find((c) => c.id === clipId)
    if (!clip) return
    isDragRef.current = true
    dragStartRef.current = x
    dragClipRef.current = clipId
    const sample = Math.max(0, Math.min(clip.buffer.length, Math.round((x / canvasW) * visSamples)))
    cursorRef.current = {clipId, sample}
    setCursorClipId(clipId)
    setCursorSample(sample)
    selectionRef.current = null
    setSelection(null)
  }, [clipsRef, cursorRef, selectionRef])

  const onMouseMove = useCallback(
    (clipId, x, canvasW, visSamples) => {
      if (!isDragRef.current || dragClipRef.current !== clipId) return
      const clip = clipsRef.current.find((c) => c.id === clipId)
      if (!clip || Math.abs(x - dragStartRef.current) < 3) return
      const a = Math.round((dragStartRef.current / canvasW) * visSamples)
      const b = Math.round((x / canvasW) * visSamples)
      const sel = {
        clipId,
        start: Math.max(0, Math.min(a, b)),
        end: Math.min(clip.buffer.length, Math.max(a, b)),
      }
      selectionRef.current = sel
      setSelection(sel)
      drawClip(clipId)
    },
    [clipsRef, selectionRef, drawClip],
  )

  const onMouseUp = useCallback(() => {
    isDragRef.current = false
    dragClipRef.current = null
  }, [])

  // ── Volume controls ────────────────────────────────────────────────────────
  const handleVolumeChange = useCallback(([v]) => {
    const val = v / 100
    setVolume(val)
    setMuted(false)
    if (gainRef.current) gainRef.current.gain.value = val
  }, [gainRef])

  const handleToggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m
      if (gainRef.current) gainRef.current.gain.value = next ? 0 : volumeRef.current
      return next
    })
  }, [gainRef, volumeRef])

  // ── Zoom ───────────────────────────────────────────────────────────────────
  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(z * 2, 32)), [])
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z / 2, 1)), [])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  // All handlers go through handlerRefs so the effect is stable (no deps array churn)
  // while always calling the latest closure.
  handlerRefs.current.pausePlayback = pausePlayback
  handlerRefs.current.startPlayback = startPlayback
  handlerRefs.current.handleCut = handleCut
  handlerRefs.current.handleCopy = handleCopy
  handlerRefs.current.handlePaste = handlePaste
  handlerRefs.current.handleUndo = handleUndo
  handlerRefs.current.handleSelectAll = handleSelectAll

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
          e.preventDefault()
          const clip = clipsRef.current.find((c) => c.id === sel.clipId)
          if (!clip) return
          const selLen = sel.end - sel.start
          const newStart = right
            ? Math.min(sel.start + step, clip.buffer.length - selLen)
            : Math.max(sel.start - step, 0)
          const newSel = {clipId: sel.clipId, start: newStart, end: newStart + selLen}
          selectionRef.current = newSel
          setSelection(newSel)
        } else {
          const cur = cursorRef.current
          if (!cur.clipId) return
          e.preventDefault()
          const clip = clipsRef.current.find((c) => c.id === cur.clipId)
          if (!clip) return
          const newSample = right
            ? Math.min(cur.sample + step, clip.buffer.length)
            : Math.max(cur.sample - step, 0)
          cursorRef.current = {clipId: cur.clipId, sample: newSample}
          setCursorSample(newSample)
        }
      }

      if (e.code === 'Escape') {
        if (selectionRef.current) {
          selectionRef.current = null
          setSelection(null)
        }
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
  }, []) // stable — reads everything via refs

  // ── Render ─────────────────────────────────────────────────────────────────
  const hasSel = !!(selection && selection.end > selection.start)
  const cursorTimeSec = cursorClipId ? cursorSample / TARGET_SAMPLE_RATE : null

  return (
    <div
      className="flex h-full flex-col p-4 md:p-6"
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true) }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDraggingOver(false) }}
      onDrop={(e) => { e.preventDefault(); importFiles(Array.from(e.dataTransfer.files)) }}
    >
      <Card
        className={cn(
          'flex flex-col border-none shadow-xl bg-transparent transition-shadow duration-150',
          isDraggingOver && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        )}
      >
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex items-center gap-3 text-2xl font-bold">
            <AudioWaveform className="h-7 w-7 text-primary" />
            Аудіоредактор
          </CardTitle>
          <CardDescription>Редактор WAV / A-law</CardDescription>
        </CardHeader>

        <CardContent className="mt-4 flex flex-col gap-4">
          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.alw"
              multiple
              className="hidden"
              onChange={(e) => {
                importFiles(Array.from(e.target.files))
                e.target.value = ''
              }}
            />

            <Button variant="outline" size="sm" onClick={() => fileInputRef.current.click()}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Імпорт
            </Button>

            <span className="h-5 w-px bg-border" />

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => (isPlaying ? pausePlayback() : startPlayback())}
              disabled={!clips.length}
              title={isPlaying ? 'Пауза' : 'Відтворити'}
            >
              {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={stopAndReset}
              disabled={!isPlaying}
              title="Стоп"
            >
              <Square className="h-3.5 w-3.5" />
            </Button>

            <span className="h-5 w-px bg-border" />

            <Button variant="outline" size="sm" onClick={handleRemove} disabled={!hasSel} title="Видалити виділення">
              <Eraser className="mr-1.5 h-3.5 w-3.5" />
              Видалити
            </Button>
            <Button variant="outline" size="sm" onClick={handleCut} disabled={!hasSel} title="Ctrl+X">
              <Scissors className="mr-1.5 h-3.5 w-3.5" />
              Вирізати
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!hasSel} title="Ctrl+C">
              <Clipboard className="mr-1.5 h-3.5 w-3.5" />
              Копіювати
            </Button>
            <Button
              variant={clipboard ? 'default' : 'outline'}
              size="sm"
              onClick={handlePaste}
              disabled={!clipboard || !cursorClipId}
              title="Ctrl+V"
            >
              <ClipboardPaste className="mr-1.5 h-3.5 w-3.5" />
              Вставити
            </Button>

            <span className="h-5 w-px bg-border" />

            <div className="flex items-center gap-1.5">
              <Label htmlFor="sil" className="whitespace-nowrap text-xs">
                Тиша (с):
              </Label>
              <Input
                id="sil"
                type="number"
                min="0.01"
                step="0.1"
                value={silenceSecs}
                onChange={(e) => setSilenceSecs(e.target.value)}
                className="h-8 w-20 text-xs"
              />
              <Button variant="outline" size="sm" onClick={handleInsertSilence} disabled={!clips.length}>
                Вставити
              </Button>
            </div>

            <span className="h-5 w-px bg-border" />

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={handleZoomOut}
                disabled={!clips.length || zoom <= 1}
                title="Зменшити масштаб"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="w-9 text-center text-xs tabular-nums text-muted-foreground">
                {zoom < 1 ? `1/${Math.round(1 / zoom)}` : `${zoom}×`}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-7 w-7"
                onClick={handleZoomIn}
                disabled={!clips.length || zoom >= 32}
                title="Збільшити масштаб"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
            </div>

            <span className="h-5 w-px bg-border" />

            <div className="flex items-center gap-2" title={`Гучність: ${Math.round(volume * 100)}%`}>
              <button
                onClick={handleToggleMute}
                className="text-muted-foreground transition-colors hover:text-foreground"
                title={muted ? 'Увімкнути звук' : 'Вимкнути звук'}
              >
                {muted || volume === 0
                  ? <VolumeX className="h-3.5 w-3.5" />
                  : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <Slider
                min={0}
                max={100}
                step={1}
                value={[Math.round(volume * 100)]}
                onValueChange={handleVolumeChange}
                className="w-24"
              />
              <span
                className="w-8 text-xs text-muted-foreground"
                style={{fontFeatureSettings: '"tnum"'}}
              >
                {Math.round(volume * 100)}%
              </span>
            </div>

            <span className="h-5 w-px bg-border" />

            <div className="relative" ref={saveRef}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSaveOpen((v) => !v)}
                disabled={!cursorClipId}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Зберегти обрану доріжку
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
              {saveOpen && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-32.5 rounded-md border border-border bg-popover py-1 shadow-md">
                  <button
                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={() => { handleSaveClipWav(); setSaveOpen(false) }}
                  >
                    Зберегти .wav
                  </button>
                  <button
                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-accent"
                    onClick={() => { handleSaveClipAlw(); setSaveOpen(false) }}
                  >
                    Зберегти .alw (8 кГц)
                  </button>
                </div>
              )}
            </div>

            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleUndo}
                disabled={!undoStack.length}
                title={`Скасувати (Ctrl+Z)${undoStack.length ? ` · ${undoStack.length}` : ''}`}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleClear}
                disabled={!clips.length}
                title="Очистити все"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* ── Track area ───────────────────────────────────────────────── */}
          {/* min-w-0 prevents this flex-item from expanding past CardContent's width */}
          <div ref={trackListRef} className="min-w-0">
            {clips.length === 0 ? (
              <div
                className={cn(
                  'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-16 text-center text-muted-foreground transition-colors',
                  isDraggingOver ? 'border-primary bg-primary/5' : 'border-border',
                )}
              >
                <AudioWaveform
                  className={cn(
                    'h-10 w-10 transition-opacity',
                    isDraggingOver ? 'opacity-60' : 'opacity-25',
                  )}
                />
                <p className="text-sm">
                  {isDraggingOver ? (
                    'Відпустіть, щоб додати файли'
                  ) : (
                    <>
                      Перетягніть WAV або ALW файли сюди або натисніть <strong>Імпорт</strong>
                    </>
                  )}
                </p>
                {!isDraggingOver && (
                  <p className="text-xs opacity-60">Кожен файл стає окремою доріжкою</p>
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-border">
                {/* Single relative wrapper so all overlays span both rulers + all tracks */}
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
                  {/* Selection edges — blue 1px, span rulers + tracks */}
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
                  <TimeRuler
                    totalSecs={maxDur / zoom}
                    pxPerSec={pxPerSec}
                    variant="bottom"
                    triangleRef={playBotTriRef}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Status bar ───────────────────────────────────────────────── */}
          <div
            className={cn(
              'flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground',
              clips.length === 0 && 'hidden',
            )}
          >
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
                <span>
                  вид.: {fmt((selection.end - selection.start) / TARGET_SAMPLE_RATE)}
                </span>
              )}
              <span>
                {clips.length} {clips.length === 1 ? 'доріжка' : 'доріжок'} · {fmt(dur)}
              </span>
            </div>
          </div>
          {clips.length === 0 && (
            <p className="text-xs text-muted-foreground">{status}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
