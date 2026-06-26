import {cn} from '@/lib/utils'
import {fmt} from './utils'

function rulerInterval(pxPerSec) {
  const targetSecs = 80 / Math.max(pxPerSec, 0.001)
  const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600]
  return steps.find((s) => s >= targetSecs) ?? 600
}

// [divisor, height_px, opacity] — each level renders only its odd multiples
// so it never overlaps with coarser levels.
const SUB_LEVELS = [
  [2, 11, 0.5],
  [4, 9, 0.35],
  [8, 7, 0.25],
  [16, 5, 0.18],
  [32, 4, 0.12],
]

// triangleRef — optional ref for a playhead indicator triangle, moved via DOM during playback.
export function TimeRuler({totalSecs, pxPerSec, variant = 'top', triangleRef}) {
  const interval = rulerInterval(pxPerSec)
  const isBottom = variant === 'bottom'
  const edge = isBottom ? {bottom: 0} : {top: 0}

  const subTicks = []
  SUB_LEVELS.forEach(([div, h, op], li) => {
    const step = interval / div
    for (let i = 1; i * step <= totalSecs + 0.001; i += 2)
      subTicks.push({px: Math.round(i * step * pxPerSec), h, op, key: `${li}-${i}`})
  })

  const majorTicks = []
  for (let i = 0; i * interval <= totalSecs + 0.001; i++)
    majorTicks.push(Math.round(i * interval * 1000) / 1000)

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-muted/20 select-none',
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
      {majorTicks.map((t) => {
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
              style={{
                marginTop: isBottom ? undefined : 2,
                marginBottom: isBottom ? 2 : undefined,
              }}
            >
              {fmt(t)}
            </span>
          </div>
        )
      })}
      {triangleRef && (
        <div
          ref={triangleRef}
          className="pointer-events-none absolute z-20 -translate-x-1/2"
          style={{display: 'none', left: 0, ...edge}}
        >
          <div
            className={cn(
              'h-0 w-0',
              isBottom
                ? 'border-x-[5px] border-b-[7px] border-x-transparent border-b-amber-400'
                : 'border-x-[5px] border-t-[7px] border-x-transparent border-t-amber-400',
            )}
          />
        </div>
      )}
    </div>
  )
}
