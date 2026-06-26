import {concatBuffers} from './audioOps'

export function fmt(s) {
  if (!isFinite(s) || s < 0) return '0:00.00'
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, '0')}`
}

export function totalDur(clips) {
  return clips.reduce((a, c) => a + c.buffer.duration, 0)
}

export function mergedOffset(clips, clipId) {
  let off = 0
  for (const c of clips) {
    if (c.id === clipId) return off
    off += c.buffer.length
  }
  return 0
}

export function playPos(clips, mergedSample) {
  let off = 0
  for (const c of clips) {
    const local = mergedSample - off
    if (local <= c.buffer.length)
      return {clipId: c.id, sample: Math.max(0, local)}
    off += c.buffer.length
  }
  const last = clips.at(-1)
  return last
    ? {clipId: last.id, sample: last.buffer.length}
    : {clipId: null, sample: 0}
}

export function buildMerged(clips) {
  if (!clips.length) return null
  let buf = clips[0].buffer
  for (let i = 1; i < clips.length; i++)
    buf = concatBuffers(buf, clips[i].buffer)
  return buf
}
