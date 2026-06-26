export const CLIP_HEIGHT = 100
export const UNDO_MAX = 20
export const BG = '#0f172a'
export const PALETTE = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6',
  '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#14b8a6',
]

let _colorIdx = 0
let _clipSeq = 0
export const nextColor = () => PALETTE[_colorIdx++ % PALETTE.length]
export const genId = () => `c${++_clipSeq}`
