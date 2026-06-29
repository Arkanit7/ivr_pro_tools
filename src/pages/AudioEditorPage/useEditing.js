import {useCallback} from 'react'
import {UNDO_MAX, genId, nextColor} from './constants'
import {TARGET_SAMPLE_RATE} from './audioOps'
import {fmt, totalDur, buildMerged} from './utils'
import {parseAlw, parseWav, pcmToAudioBuffer, encodeWav, encodeAlwBytes, downsampleTo8k} from './wavUtils'
import {
  normalizeBuffer,
  extractBuffer,
  cutBuffer,
  insertBuffer,
  insertSilence,
} from './audioOps'

// silenceSecsRef — a ref whose .current is always the latest silenceSecs string value,
// so handleInsertSilence can stay stable without re-creating on every keystroke.
export function useEditing({
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
}) {
  const pushUndo = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-UNDO_MAX + 1), clipsRef.current])
  }, [setUndoStack, clipsRef])

  const handleUndo = useCallback(() => {
    const stack = undoStackRef.current
    if (!stack.length) return
    const prev = stack[stack.length - 1]
    setUndoStack((s) => s.slice(0, -1))
    setClips(prev)
    setCursorClipId(null)
    setCursorSample(0)
    setSelection(null)
    setStatus('Скасовано.')
  }, [undoStackRef, setUndoStack, setClips, setCursorClipId, setCursorSample, setSelection, setStatus])

  // ── Import ──────────────────────────────────────────────────────────────────

  const decodeFile = useCallback(
    async (file) => {
      const ext = file.name.split('.').pop().toLowerCase()
      if (!['wav', 'alw'].includes(ext))
        throw new Error(`Непідтримуваний формат: .${ext}`)
      const ab = await file.arrayBuffer()
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
    },
    [getCtx],
  )

  const importFiles = useCallback(
    async (files) => {
      if (!files.length) return
      setIsDraggingOver(false)
      setStatus(
        `Завантаження ${files.length === 1 ? files[0].name : `${files.length} файлів`}…`,
      )
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
          setStatus(`Помилка: ${err.message}`)
          return
        }
      }
      pushUndo()
      const next = [...existing, ...newClips]
      setClips(next)
      setStatus(
        newClips.length === 1
          ? `Завантажено ${files[0].name} — ${fmt(newClips[0].buffer.duration)}`
          : `Завантажено ${newClips.length} файлів — разом ${fmt(totalDur(next))}`,
      )
    },
    [decodeFile, pushUndo, clipsRef, setClips, setStatus, setIsDraggingOver],
  )

  // ── Clip management ─────────────────────────────────────────────────────────

  const handleDeleteClip = useCallback(
    (clipId) => {
      pushUndo()
      setClips((prev) => prev.filter((c) => c.id !== clipId))
      if (cursorRef.current.clipId === clipId) {
        setCursorClipId(null)
        setCursorSample(0)
      }
      if (selectionRef.current?.clipId === clipId) setSelection(null)
    },
    [pushUndo, setClips, cursorRef, setCursorClipId, setCursorSample, selectionRef, setSelection],
  )

  const handleMoveUp = useCallback(
    (index) => {
      pushUndo()
      setClips((prev) => {
        const n = [...prev]
        ;[n[index - 1], n[index]] = [n[index], n[index - 1]]
        return n
      })
    },
    [pushUndo, setClips],
  )

  const handleMoveDown = useCallback(
    (index) => {
      pushUndo()
      setClips((prev) => {
        const n = [...prev]
        ;[n[index], n[index + 1]] = [n[index + 1], n[index]]
        return n
      })
    },
    [pushUndo, setClips],
  )

  const handleRename = useCallback(
    (clipId, newName) => {
      setClips((prev) => prev.map((c) => (c.id === clipId ? {...c, name: newName} : c)))
    },
    [setClips],
  )

  // ── Selection editing ───────────────────────────────────────────────────────

  const handleRemove = useCallback(() => {
    const sel = selectionRef.current
    if (!sel || sel.end <= sel.start) {
      setStatus('Спочатку виділіть ділянку.')
      return
    }
    const clip = clipsRef.current.find((c) => c.id === sel.clipId)
    if (!clip) return
    const newBuffer = cutBuffer(clip.buffer, sel.start, sel.end)
    pushUndo()
    if (!newBuffer) {
      setClips((prev) => prev.filter((c) => c.id !== clip.id))
      setCursorClipId(null)
      setCursorSample(0)
    } else {
      setClips((prev) =>
        prev.map((c) => (c.id === clip.id ? {...c, buffer: newBuffer} : c)),
      )
      setCursorClipId(clip.id)
      setCursorSample(sel.start)
    }
    setSelection(null)
    setStatus(`Видалено ${fmt((sel.end - sel.start) / TARGET_SAMPLE_RATE)}.`)
  }, [pushUndo, clipsRef, selectionRef, setClips, setCursorClipId, setCursorSample, setSelection, setStatus])

  const handleCut = useCallback(() => {
    const sel = selectionRef.current
    if (!sel || sel.end <= sel.start) {
      setStatus('Спочатку виділіть ділянку.')
      return
    }
    const clip = clipsRef.current.find((c) => c.id === sel.clipId)
    if (!clip) return
    const extracted = extractBuffer(clip.buffer, sel.start, sel.end)
    const cb = {buffer: extracted, color: clip.color, name: clip.name}
    clipboardRef.current = cb
    setClipboard(cb)
    const newBuffer = cutBuffer(clip.buffer, sel.start, sel.end)
    pushUndo()
    if (!newBuffer) {
      setClips((prev) => prev.filter((c) => c.id !== clip.id))
      setCursorClipId(null)
      setCursorSample(0)
    } else {
      setClips((prev) =>
        prev.map((c) => (c.id === clip.id ? {...c, buffer: newBuffer} : c)),
      )
      setCursorClipId(clip.id)
      setCursorSample(sel.start)
    }
    setSelection(null)
    setStatus(`Вирізано ${fmt((sel.end - sel.start) / TARGET_SAMPLE_RATE)} → буфер.`)
  }, [pushUndo, clipsRef, selectionRef, clipboardRef, setClips, setClipboard, setCursorClipId, setCursorSample, setSelection, setStatus])

  const handleCopy = useCallback(() => {
    const sel = selectionRef.current
    if (!sel || sel.end <= sel.start) {
      setStatus('Спочатку виділіть ділянку.')
      return
    }
    const clip = clipsRef.current.find((c) => c.id === sel.clipId)
    if (!clip) return
    const cb = {
      buffer: extractBuffer(clip.buffer, sel.start, sel.end),
      color: clip.color,
      name: clip.name,
    }
    clipboardRef.current = cb
    setClipboard(cb)
    setStatus(`Скопійовано ${fmt((sel.end - sel.start) / TARGET_SAMPLE_RATE)} до буфера.`)
  }, [clipsRef, selectionRef, clipboardRef, setClipboard, setStatus])

  const handlePaste = useCallback(() => {
    const cb = clipboardRef.current
    const cur = cursorRef.current
    if (!cb) {
      setStatus('Буфер обміну порожній.')
      return
    }
    if (!cur.clipId) {
      setStatus('Клацніть на доріжку, щоб встановити позицію вставки.')
      return
    }
    const clip = clipsRef.current.find((c) => c.id === cur.clipId)
    if (!clip) return
    pushUndo()
    setClips((prev) =>
      prev.map((c) =>
        c.id === clip.id
          ? {...c, buffer: insertBuffer(clip.buffer, cur.sample, cb.buffer)}
          : c,
      ),
    )
    setCursorSample(cur.sample + cb.buffer.length)
    setStatus(`Вставлено ${fmt(cb.buffer.duration)}.`)
  }, [pushUndo, clipsRef, cursorRef, clipboardRef, setClips, setCursorSample, setStatus])

  const handleInsertSilence = useCallback(() => {
    const clips = clipsRef.current
    if (!clips.length) {
      setStatus('Спочатку імпортуйте аудіо.')
      return
    }
    const secs = parseFloat(silenceSecsRef.current ?? '1')
    if (!isFinite(secs) || secs <= 0) {
      setStatus('Введіть позитивне значення секунд.')
      return
    }
    const silSamples = Math.round(secs * TARGET_SAMPLE_RATE)
    const cur = cursorRef.current
    pushUndo()
    if (!cur.clipId) {
      const last = clips[clips.length - 1]
      setClips((prev) =>
        prev.map((c) =>
          c.id === last.id
            ? {...c, buffer: insertSilence(last.buffer, last.buffer.length, silSamples)}
            : c,
        ),
      )
      setStatus(`Додано ${secs}с тиші.`)
      return
    }
    const clip = clips.find((c) => c.id === cur.clipId)
    if (!clip) return
    setClips((prev) =>
      prev.map((c) =>
        c.id === clip.id
          ? {...c, buffer: insertSilence(clip.buffer, cur.sample, silSamples)}
          : c,
      ),
    )
    setCursorSample(cur.sample + silSamples)
    setStatus(`Вставлено ${secs}с тиші.`)
  }, [pushUndo, clipsRef, cursorRef, silenceSecsRef, setClips, setCursorSample, setStatus])

  // ── Select all / clear ──────────────────────────────────────────────────────

  const handleSelectAll = useCallback(() => {
    const clips = clipsRef.current
    if (!clips.length) return
    const targetId = cursorRef.current.clipId ?? clips[0].id
    const clip = clips.find((c) => c.id === targetId)
    if (!clip) return
    const sel = {clipId: clip.id, start: 0, end: clip.buffer.length}
    selectionRef.current = sel
    setSelection(sel)
    setCursorClipId(clip.id)
    setStatus(`Виділено всю доріжку «${clip.name}».`)
  }, [clipsRef, cursorRef, selectionRef, setSelection, setCursorClipId, setStatus])

  const handleClear = useCallback(() => {
    stopAndReset()
    pushUndo()
    setClips([])
    setCursorClipId(null)
    setCursorSample(0)
    setSelection(null)
    setClipboard(null)
    setZoom(1)
    setStatus('Очищено.')
  }, [stopAndReset, pushUndo, setClips, setCursorClipId, setCursorSample, setSelection, setClipboard, setZoom, setStatus])

  // ── Export ──────────────────────────────────────────────────────────────────

  const handleExportWav = useCallback(() => {
    const clips = clipsRef.current
    if (!clips.length) {
      setStatus('Немає чого експортувати.')
      return
    }
    const merged = buildMerged(clips)
    if (!merged) return
    const blob = encodeWav(merged)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'audio_export.wav'
    a.click()
    URL.revokeObjectURL(url)
    setStatus(`Експортовано audio_export.wav — ${fmt(merged.duration)}`)
  }, [clipsRef, setStatus])

  const handleExportAlw = useCallback(async () => {
    const clips = clipsRef.current
    if (!clips.length) {
      setStatus('Немає чого експортувати.')
      return
    }
    setStatus('Кодування ALW…')
    try {
      const merged = buildMerged(clips)
      if (!merged) return
      const mono8k = await downsampleTo8k(merged)
      const blob = encodeAlwBytes(mono8k)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'audio_export.alw'
      a.click()
      URL.revokeObjectURL(url)
      setStatus(`Експортовано audio_export.alw — ${fmt(mono8k.duration)} @ 8 кГц моно`)
    } catch (err) {
      setStatus(`Помилка експорту: ${err.message}`)
    }
  }, [clipsRef, setStatus])

  const handleSaveClipWav = useCallback(() => {
    const clip = clipsRef.current.find((c) => c.id === cursorRef.current.clipId)
    if (!clip) return
    const blob = encodeWav(clip.buffer)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = clip.name.replace(/\.[^.]+$/, '') + '.wav'
    a.click()
    URL.revokeObjectURL(url)
    setStatus(`Збережено «${clip.name}» як .wav`)
  }, [clipsRef, cursorRef, setStatus])

  const handleSaveClipAlw = useCallback(async () => {
    const clip = clipsRef.current.find((c) => c.id === cursorRef.current.clipId)
    if (!clip) return
    setStatus('Кодування ALW…')
    try {
      const mono8k = await downsampleTo8k(clip.buffer)
      const blob = encodeAlwBytes(mono8k)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = clip.name.replace(/\.[^.]+$/, '') + '.alw'
      a.click()
      URL.revokeObjectURL(url)
      setStatus(`Збережено «${clip.name}» як .alw @ 8 кГц моно`)
    } catch (err) {
      setStatus(`Помилка збереження: ${err.message}`)
    }
  }, [clipsRef, cursorRef, setStatus])

  return {
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
  }
}
