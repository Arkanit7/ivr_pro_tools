import {BG} from './constants'

// visSamples: how many audio samples map to the full canvas width.
// Shorter clips only fill (clip.length / visSamples) of the canvas; the rest stays dark.
// This keeps the layout fixed — the canvas never expands beyond its CSS width.
export function drawCanvas(canvas, clip, localCursor, localSel, localPlayhead, visSamples) {
  const ctx = canvas.getContext('2d')
  const W = canvas.width
  const H = canvas.height
  if (!W || !H) return

  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, H)

  const buf = clip.buffer
  const vis = Math.max(1, visSamples ?? buf.length)
  const spx = vis / W
  const drawW = Math.min(W, Math.ceil(buf.length / spx))
  const numCh = Math.min(buf.numberOfChannels, 2)

  for (let ch = 0; ch < numCh; ch++) {
    const chH = H / numCh
    const mid = ch * chH + chH / 2
    const hh = chH / 2
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

  if (localSel && localSel.end > localSel.start) {
    const s2x = (s) => Math.round((s / vis) * W)
    const x0 = s2x(localSel.start)
    const x1 = s2x(localSel.end)
    ctx.fillStyle = 'rgba(96,165,250,0.45)'
    ctx.fillRect(x0, 0, x1 - x0, H)
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x0, 0)
    ctx.lineTo(x0, H)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x1, 0)
    ctx.lineTo(x1, H)
    ctx.stroke()
  }
}
