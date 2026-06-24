import {useState, useRef, useCallback, useEffect} from 'react'
import {Upload, Scissors, Play, Pause, Square, Download, Undo2, Trash2, AudioWaveform} from 'lucide-react'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {parseAlw, parseWav, pcmToAudioBuffer, encodeWav} from './wavUtils'
import {normalizeBuffer, concatBuffers, cutBuffer, insertSilence, TARGET_SAMPLE_RATE} from './audioOps'

const CANVAS_HEIGHT = 180
const UNDO_MAX = 20
const WAVEFORM_COLOR_L = '#22c55e'
const WAVEFORM_COLOR_R = '#3b82f6'
const PLAYHEAD_COLOR = '#f59e0b'
const SELECTION_FILL = 'rgba(59,130,246,0.22)'
const SELECTION_EDGE = 'rgba(59,130,246,0.7)'
const BG_COLOR = '#0f172a'

function fmt(seconds) {
  if (!isFinite(seconds)) return '0:00.00'
  const m = Math.floor(seconds / 60)
  const s = (seconds % 60).toFixed(2).padStart(5, '0')
  return `${m}:${s}`
}

function pxToSample(px, totalSamples, canvasWidth) {
  return Math.max(0, Math.min(totalSamples, Math.round((px / canvasWidth) * totalSamples)))
}

function sampleToPx(sample, totalSamples, canvasWidth) {
  return (sample / totalSamples) * canvasWidth
}

export default function AudioEditorPage() {
  const [timeline, setTimeline] = useState(null)
  const [cursor, setCursor] = useState(0)
  const [selection, setSelection] = useState(null)
  const [undoStack, setUndoStack] = useState([])
  const [status, setStatus] = useState('Import a WAV or ALW file, or drag & drop it here.')
  const [isPlaying, setIsPlaying] = useState(false)
  const [silenceSecs, setSilenceSecs] = useState('1')

  // Refs that drawWaveform and rAF callbacks read directly (avoids stale closure issues)
  const timelineRef = useRef(null)
  const selectionRef = useRef(null)
  const playheadRef = useRef(0)  // current draw position (= cursor when stopped)
  const isPlayingRef = useRef(false)

  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const audioCtxRef = useRef(null)
  const sourceRef = useRef(null)
  const playStartTimeRef = useRef(0)
  const playOffsetSecsRef = useRef(0)
  const animFrameRef = useRef(null)
  const isDraggingRef = useRef(false)
  const dragStartPxRef = useRef(0)
  const manualStopRef = useRef(false)

  // Keep refs in sync with state
  useEffect(() => { timelineRef.current = timeline }, [timeline])
  useEffect(() => { selectionRef.current = selection }, [selection])
  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => {
    if (!isPlayingRef.current) {
      playheadRef.current = cursor
      drawWaveform()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, timeline, selection])

  const getAudioCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext()
    }
    return audioCtxRef.current
  }

  // ─── Waveform drawing ───────────────────────────────────────────────────────

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const buf = timelineRef.current
    const sel = selectionRef.current
    const ph = playheadRef.current

    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, W, H)

    if (!buf) {
      ctx.fillStyle = '#475569'
      ctx.font = '14px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('No audio loaded — import a file to start', W / 2, H / 2)
      return
    }

    const totalSamples = buf.length
    const samplesPerPx = totalSamples / W
    const numCh = Math.min(buf.numberOfChannels, 2)

    for (let ch = 0; ch < numCh; ch++) {
      const chH = H / numCh
      const chTop = ch * chH
      const mid = chTop + chH / 2
      const halfH = chH / 2

      ctx.fillStyle = ch === 0 ? WAVEFORM_COLOR_L : WAVEFORM_COLOR_R
      const data = buf.getChannelData(ch)

      for (let x = 0; x < W; x++) {
        const s0 = Math.floor(x * samplesPerPx)
        const s1 = Math.max(s0 + 1, Math.floor((x + 1) * samplesPerPx))
        let mn = 0, mx = 0
        for (let i = s0; i < s1; i++) {
          if (data[i] < mn) mn = data[i]
          if (data[i] > mx) mx = data[i]
        }
        const yTop = mid - mx * halfH
        const yBot = mid - mn * halfH
        ctx.fillRect(x, yTop, 1, Math.max(1, yBot - yTop))
      }
    }

    // Selection overlay
    if (sel && sel.end > sel.start) {
      const x0 = sampleToPx(sel.start, totalSamples, W)
      const x1 = sampleToPx(sel.end, totalSamples, W)
      ctx.fillStyle = SELECTION_FILL
      ctx.fillRect(x0, 0, x1 - x0, H)
      ctx.strokeStyle = SELECTION_EDGE
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, H); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, H); ctx.stroke()
    }

    // Playhead
    const phPx = sampleToPx(ph, totalSamples, W)
    ctx.strokeStyle = PLAYHEAD_COLOR
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(phPx, 0)
    ctx.lineTo(phPx, H)
    ctx.stroke()
  }, [])

  // Canvas resize observer
  useEffect(() => {
    const canvas = canvasRef.current
    const resize = () => {
      canvas.width = canvas.parentElement.clientWidth
      canvas.height = CANVAS_HEIGHT
      drawWaveform()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement)
    resize()
    return () => ro.disconnect()
  }, [drawWaveform])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (sourceRef.current) try { sourceRef.current.stop() } catch {}
      if (audioCtxRef.current) audioCtxRef.current.close()
    }
  }, [])

  // ─── File import ────────────────────────────────────────────────────────────

  const decodeFile = async (file) => {
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['wav', 'alw'].includes(ext)) {
      throw new Error(`Unsupported file type: .${ext}`)
    }
    const arrayBuffer = await file.arrayBuffer()
    const audioCtx = getAudioCtx()

    if (ext === 'alw') {
      const {pcm, sampleRate, numChannels} = parseAlw(arrayBuffer)
      return pcmToAudioBuffer(pcm, sampleRate, numChannels, TARGET_SAMPLE_RATE)
    }

    // Try native decode first (handles standard PCM WAV, MP3, etc.)
    try {
      return await audioCtx.decodeAudioData(arrayBuffer.slice(0))
    } catch {
      // Fallback for A-law / µ-law WAV that browsers reject
      const parsed = parseWav(arrayBuffer)
      return pcmToAudioBuffer(parsed.pcm, parsed.sampleRate, parsed.numChannels, TARGET_SAMPLE_RATE)
    }
  }

  const appendBuffer = async (existing, incoming) => {
    const maxCh = Math.max(existing.numberOfChannels, incoming.numberOfChannels)
    const a = await normalizeBuffer(existing, maxCh)
    const b = await normalizeBuffer(incoming, maxCh)
    return concatBuffers(a, b)
  }

  const importFiles = useCallback(async (files) => {
    let tl = timelineRef.current
    const prevTl = tl
    let loaded = 0

    for (const file of files) {
      setStatus(`Loading ${file.name}…`)
      try {
        let buf = await decodeFile(file)
        buf = await normalizeBuffer(buf, buf.numberOfChannels)
        tl = tl ? await appendBuffer(tl, buf) : buf
        loaded++
      } catch (err) {
        setStatus(`Error: ${err.message}`)
        return
      }
    }

    if (!tl) return
    if (prevTl) {
      setUndoStack(prev => [...prev.slice(-UNDO_MAX + 1), prevTl])
    }
    setTimeline(tl)
    setCursor(0)
    setSelection(null)
    setStatus(
      loaded === 1
        ? `Loaded ${files[0].name} — ${fmt(tl.duration)}`
        : `Loaded ${loaded} files — total ${fmt(tl.duration)}`
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileChange = (e) => {
    importFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    importFiles(Array.from(e.dataTransfer.files))
  }

  // ─── Playback ───────────────────────────────────────────────────────────────

  const cancelAnim = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
  }

  const pausePlayback = useCallback(() => {
    manualStopRef.current = true
    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch {}
      sourceRef.current = null
    }
    cancelAnim()
    // Keep playhead position as the new cursor
    const stopped = playheadRef.current
    setCursor(stopped)
    setIsPlaying(false)
    drawWaveform()
  }, [drawWaveform])

  const stopPlayback = useCallback(() => {
    manualStopRef.current = true
    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch {}
      sourceRef.current = null
    }
    cancelAnim()
    playheadRef.current = 0
    setCursor(0)
    setIsPlaying(false)
    drawWaveform()
  }, [drawWaveform])

  const startPlayback = useCallback((fromSample) => {
    const buf = timelineRef.current
    if (!buf) return

    const audioCtx = getAudioCtx()
    if (audioCtx.state === 'suspended') audioCtx.resume()

    const offsetSecs = (fromSample ?? playheadRef.current) / TARGET_SAMPLE_RATE
    const source = audioCtx.createBufferSource()
    source.buffer = buf
    source.connect(audioCtx.destination)
    source.start(0, offsetSecs)

    source.onended = () => {
      if (manualStopRef.current) {
        manualStopRef.current = false
        return
      }
      // Natural end: reset to start
      cancelAnim()
      playheadRef.current = 0
      setCursor(0)
      setIsPlaying(false)
      sourceRef.current = null
      drawWaveform()
    }

    sourceRef.current = source
    playStartTimeRef.current = audioCtx.currentTime
    playOffsetSecsRef.current = offsetSecs
    setIsPlaying(true)

    const tick = () => {
      const ctx = audioCtxRef.current
      if (!ctx) return
      const elapsed = ctx.currentTime - playStartTimeRef.current
      const posSample = Math.min(
        Math.round((playOffsetSecsRef.current + elapsed) * TARGET_SAMPLE_RATE),
        (timelineRef.current?.length ?? 0)
      )
      playheadRef.current = posSample
      drawWaveform()
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawWaveform])

  const handlePlayPause = () => {
    if (isPlaying) pausePlayback()
    else startPlayback()
  }

  // ─── Edit operations ────────────────────────────────────────────────────────

  const pushUndo = (buf) => setUndoStack(prev => [...prev.slice(-UNDO_MAX + 1), buf])

  const handleCut = () => {
    if (!timeline || !selection || selection.end <= selection.start) {
      setStatus('Select a region on the waveform first.')
      return
    }
    pushUndo(timeline)
    const result = cutBuffer(timeline, selection.start, selection.end)
    if (!result) {
      setStatus('Nothing left after cut.')
      return
    }
    setTimeline(result)
    setCursor(Math.min(selection.start, result.length))
    setSelection(null)
    const removed = (selection.end - selection.start) / TARGET_SAMPLE_RATE
    setStatus(`Removed ${fmt(removed)} — remaining: ${fmt(result.duration)}`)
  }

  const handleInsertSilence = () => {
    if (!timeline) { setStatus('Load audio first.'); return }
    const secs = parseFloat(silenceSecs)
    if (!isFinite(secs) || secs <= 0) { setStatus('Enter a positive number of seconds.'); return }
    pushUndo(timeline)
    const durationSamples = Math.round(secs * TARGET_SAMPLE_RATE)
    const result = insertSilence(timeline, cursor, durationSamples)
    setTimeline(result)
    setCursor(cursor + durationSamples)
    setStatus(`Inserted ${secs}s silence at ${fmt(cursor / TARGET_SAMPLE_RATE)}`)
  }

  const handleUndo = () => {
    if (!undoStack.length) return
    const prev = undoStack[undoStack.length - 1]
    setUndoStack(s => s.slice(0, -1))
    setTimeline(prev)
    setCursor(0)
    setSelection(null)
    setStatus('Undo.')
  }

  const handleClear = () => {
    stopPlayback()
    setTimeline(null)
    setCursor(0)
    setSelection(null)
    setUndoStack([])
    setStatus('Cleared.')
  }

  const handleExport = () => {
    if (!timeline) { setStatus('Nothing to export.'); return }
    const blob = encodeWav(timeline)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'audio_export.wav'
    a.click()
    URL.revokeObjectURL(url)
    setStatus('Exported audio_export.wav')
  }

  // ─── Canvas interaction ─────────────────────────────────────────────────────

  const handleMouseDown = (e) => {
    if (!timelineRef.current) return
    const canvas = canvasRef.current
    const x = e.clientX - canvas.getBoundingClientRect().left
    dragStartPxRef.current = x
    isDraggingRef.current = true
    const sample = pxToSample(x, timelineRef.current.length, canvas.width)
    playheadRef.current = sample
    setCursor(sample)
    selectionRef.current = null
    setSelection(null)
  }

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !timelineRef.current) return
    const canvas = canvasRef.current
    const x = e.clientX - canvas.getBoundingClientRect().left
    if (Math.abs(x - dragStartPxRef.current) < 3) return
    const total = timelineRef.current.length
    const a = pxToSample(dragStartPxRef.current, total, canvas.width)
    const b = pxToSample(x, total, canvas.width)
    const sel = {start: Math.min(a, b), end: Math.max(a, b)}
    selectionRef.current = sel
    setSelection(sel)
    drawWaveform()
  }

  const handleMouseUp = () => { isDraggingRef.current = false }

  // Space bar = play/pause
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        if (isPlayingRef.current) pausePlayback()
        else if (timelineRef.current) startPlayback()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pausePlayback, startPlayback])

  // ─── Render ─────────────────────────────────────────────────────────────────

  const hasSel = !!(selection && selection.end > selection.start)

  return (
    <div
      className="flex h-full flex-col gap-4 p-4 md:p-6"
      onDragOver={e => e.preventDefault()}
      onDrop={handleDrop}
    >
      <Card className="flex flex-col border-none shadow-xl">
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex items-center gap-3 text-2xl font-bold">
            <AudioWaveform className="h-7 w-7 text-primary" />
            Аудіоредактор
          </CardTitle>
          <CardDescription>
            WAV / A-law (ALW) editor — import, cut, insert silence, glue, export
          </CardDescription>
        </CardHeader>

        <CardContent className="mt-4 flex flex-col gap-4">

          {/* ── Toolbar ── */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".wav,.alw"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            <Button variant="outline" onClick={() => fileInputRef.current.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>

            <span className="h-6 w-px bg-border" />

            <Button variant="outline" onClick={handlePlayPause} disabled={!timeline}>
              {isPlaying
                ? <><Pause className="mr-2 h-4 w-4" />Pause</>
                : <><Play  className="mr-2 h-4 w-4" />Play</>}
            </Button>

            <Button variant="outline" onClick={stopPlayback} disabled={!timeline || !isPlaying}>
              <Square className="mr-2 h-4 w-4" />
              Stop
            </Button>

            <span className="h-6 w-px bg-border" />

            <Button variant="outline" onClick={handleCut} disabled={!hasSel}>
              <Scissors className="mr-2 h-4 w-4" />
              Cut selection
            </Button>

            <span className="h-6 w-px bg-border" />

            <div className="flex items-center gap-2">
              <Label htmlFor="sil-secs" className="whitespace-nowrap text-sm">
                Silence (s):
              </Label>
              <Input
                id="sil-secs"
                type="number"
                min="0.01"
                step="0.1"
                value={silenceSecs}
                onChange={e => setSilenceSecs(e.target.value)}
                className="w-20"
              />
              <Button variant="outline" onClick={handleInsertSilence} disabled={!timeline}>
                Insert
              </Button>
            </div>

            <span className="h-6 w-px bg-border" />

            <Button variant="outline" onClick={handleExport} disabled={!timeline}>
              <Download className="mr-2 h-4 w-4" />
              Export WAV
            </Button>

            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="icon"
                title="Undo"
                onClick={handleUndo}
                disabled={!undoStack.length}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                title="Clear"
                onClick={handleClear}
                disabled={!timeline}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* ── Waveform canvas ── */}
          <div
            className="w-full overflow-hidden rounded-lg"
            style={{background: BG_COLOR}}
          >
            <canvas
              ref={canvasRef}
              style={{display: 'block', cursor: 'crosshair'}}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          {/* ── Status / position bar ── */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>{status}</span>
            {timeline && (
              <span className="tabular-nums">
                {fmt(cursor / TARGET_SAMPLE_RATE)} / {fmt(timeline.duration)}
                {hasSel && ` | sel ${fmt((selection.end - selection.start) / TARGET_SAMPLE_RATE)}`}
                {timeline.numberOfChannels > 1 && ' | stereo'}
              </span>
            )}
          </div>

        </CardContent>
      </Card>
    </div>
  )
}
