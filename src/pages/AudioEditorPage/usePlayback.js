import {useRef, useState, useCallback, useEffect} from 'react'
import {TARGET_SAMPLE_RATE} from './audioOps'
import {buildMerged, mergedOffset, playPos} from './utils'

// Manages the Web Audio context, gain node, RAF animation loop, and all playback state.
//
// visSamplesRef / containerWidthRef are updated every render by the caller so that
// the stable RAF tick always reads current values without re-creating the closure.
export function usePlayback({
  clipsRef,
  cursorRef,
  visSamplesRef,
  containerWidthRef,
  volumeRef,
  mutedRef,
  handlerRefs,
  setCursorClipId,
  setCursorSample,
}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const isPlayingRef = useRef(false)

  const audioCtxRef = useRef(null)
  const gainRef = useRef(null)
  const sourceRef = useRef(null)
  const playStartRef = useRef(0)
  const playOffsetRef = useRef(0)
  const playPosRef = useRef(0)
  const animRef = useRef(null)
  const manualStopRef = useRef(false)

  const playOverlayRef = useRef(null)
  const playTopTriRef = useRef(null)
  const playBotTriRef = useRef(null)

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed')
      audioCtxRef.current = new AudioContext()
    return audioCtxRef.current
  }, [])

  const getGain = useCallback(() => {
    const ctx = getCtx()
    if (!gainRef.current || gainRef.current.context !== ctx) {
      gainRef.current = ctx.createGain()
      gainRef.current.gain.value = mutedRef.current ? 0 : volumeRef.current
      gainRef.current.connect(ctx.destination)
    }
    return gainRef.current
  }, [getCtx, mutedRef, volumeRef])

  const cancelAnim = useCallback(() => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current)
      animRef.current = null
    }
  }, [])

  const hidePlayhead = useCallback(() => {
    if (playOverlayRef.current) playOverlayRef.current.style.display = 'none'
    if (playTopTriRef.current) playTopTriRef.current.style.display = 'none'
    if (playBotTriRef.current) playBotTriRef.current.style.display = 'none'
  }, [])

  const pausePlayback = useCallback(() => {
    manualStopRef.current = true
    if (sourceRef.current) {
      try {
        sourceRef.current.stop()
      } catch {}
      sourceRef.current = null
    }
    cancelAnim()
    hidePlayhead()
    const pos = playPos(clipsRef.current, playPosRef.current)
    setCursorClipId(pos.clipId)
    setCursorSample(pos.sample)
    cursorRef.current = {clipId: pos.clipId, sample: pos.sample}
    setIsPlaying(false)
    isPlayingRef.current = false
    handlerRefs.current.drawAll?.()
  }, [cancelAnim, hidePlayhead, clipsRef, cursorRef, setCursorClipId, setCursorSample, handlerRefs])

  const stopAndReset = useCallback(() => {
    manualStopRef.current = true
    if (sourceRef.current) {
      try {
        sourceRef.current.stop()
      } catch {}
      sourceRef.current = null
    }
    cancelAnim()
    hidePlayhead()
    playPosRef.current = 0
    const firstId = clipsRef.current[0]?.id ?? null
    setCursorClipId(firstId)
    setCursorSample(0)
    cursorRef.current = {clipId: firstId, sample: 0}
    setIsPlaying(false)
    isPlayingRef.current = false
    handlerRefs.current.drawAll?.()
  }, [cancelAnim, hidePlayhead, clipsRef, cursorRef, setCursorClipId, setCursorSample, handlerRefs])

  const startPlayback = useCallback(() => {
    const clips = clipsRef.current
    if (!clips.length) return
    const merged = buildMerged(clips)
    if (!merged) return
    const audioCtx = getCtx()
    if (audioCtx.state === 'suspended') audioCtx.resume()
    const cur = cursorRef.current
    const start = cur.clipId ? mergedOffset(clips, cur.clipId) + cur.sample : 0
    // If a clip is focused, stop at the end of that clip — don't bleed into the next one.
    const focusedClip = cur.clipId ? clips.find((c) => c.id === cur.clipId) : null
    const remaining = focusedClip
      ? Math.max(0, focusedClip.buffer.length - cur.sample)
      : null
    const src = audioCtx.createBufferSource()
    src.buffer = merged
    src.connect(getGain())
    if (remaining)
      src.start(0, start / TARGET_SAMPLE_RATE, remaining / TARGET_SAMPLE_RATE)
    else
      src.start(0, start / TARGET_SAMPLE_RATE)
    src.onended = () => {
      if (manualStopRef.current) {
        manualStopRef.current = false
        return
      }
      cancelAnim()
      hidePlayhead()
      playPosRef.current = 0
      const returnId = cur.clipId ?? clipsRef.current[0]?.id ?? null
      setCursorClipId(returnId)
      setCursorSample(cur.sample)
      cursorRef.current = {clipId: returnId, sample: cur.sample}
      setIsPlaying(false)
      isPlayingRef.current = false
      sourceRef.current = null
      handlerRefs.current.drawAll?.()
    }
    sourceRef.current = src
    playStartRef.current = audioCtx.currentTime
    playOffsetRef.current = start
    playPosRef.current = start
    setIsPlaying(true)
    isPlayingRef.current = true
    if (playOverlayRef.current) playOverlayRef.current.style.display = 'block'
    if (playTopTriRef.current) playTopTriRef.current.style.display = 'block'
    if (playBotTriRef.current) playBotTriRef.current.style.display = 'block'

    const tick = () => {
      const ctx = audioCtxRef.current
      if (!ctx) return
      playPosRef.current =
        playOffsetRef.current +
        Math.round((ctx.currentTime - playStartRef.current) * TARGET_SAMPLE_RATE)
      const ph = playPosRef.current
      const allClips = clipsRef.current
      let off = 0
      let localPh = 0
      for (const c of allClips) {
        const local = ph - off
        if (local <= c.buffer.length) {
          localPh = Math.max(0, local)
          break
        }
        off += c.buffer.length
      }
      const px = Math.round(
        (localPh / Math.max(1, visSamplesRef.current)) * containerWidthRef.current,
      )
      if (playOverlayRef.current) playOverlayRef.current.style.left = px + 'px'
      if (playTopTriRef.current) playTopTriRef.current.style.left = px + 'px'
      if (playBotTriRef.current) playBotTriRef.current.style.left = px + 'px'
      handlerRefs.current.drawAll?.()
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
  }, [cancelAnim, hidePlayhead, clipsRef, cursorRef, visSamplesRef, containerWidthRef, getCtx, getGain, setCursorClipId, setCursorSample, handlerRefs])

  useEffect(
    () => () => {
      cancelAnim()
      if (sourceRef.current) try { sourceRef.current.stop() } catch {}
      audioCtxRef.current?.close()
    },
    [cancelAnim],
  )

  return {
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
  }
}
