import {memo, useRef, useEffect, useState} from 'react'
import {ChevronUp, ChevronDown, Trash2} from 'lucide-react'
import {cn} from '@/lib/utils'
import {CLIP_HEIGHT, BG} from './constants'
import {fmt} from './utils'

export const ClipRow = memo(function ClipRow({
  clip,
  index,
  totalClips,
  visSamples,
  isFocused,
  onRegister,
  onUnregister,
  onNeedRedraw,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMoveUp,
  onMoveDown,
  onDelete,
  onRename,
}) {
  const canvasRef = useRef(null)
  const inputRef = useRef(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(clip.name)

  useEffect(() => {
    setEditName(clip.name)
  }, [clip.name])

  useEffect(() => {
    if (isEditing) inputRef.current?.select()
  }, [isEditing])

  const commitRename = () => {
    setIsEditing(false)
    const name = editName.trim()
    if (name && name !== clip.name) onRename(clip.id, name)
    else setEditName(clip.name)
  }

  // Register canvas with parent so drawAll can reach it.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    onRegister(clip.id, canvas)
    return () => onUnregister(clip.id)
  }, [clip.id, onRegister, onUnregister])

  // Canvas fills its CSS parent; observe the parent for size changes.
  // Parent is always containerWidth-constrained (no minWidth expansion),
  // so parent.clientWidth is stable — no circular feedback here.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    const resize = () => {
      canvas.width = parent.clientWidth
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
    <div
      className={cn(
        'overflow-hidden rounded-lg border transition-colors duration-150',
        isFocused ? 'border-primary ring-1 ring-primary' : 'border-border',
      )}
    >
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-1.5">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{background: clip.color}}
        />

        {isEditing ? (
          <input
            ref={inputRef}
            className="min-w-0 flex-1 border-b border-primary bg-transparent text-xs font-medium outline-none"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitRename()
              }
              if (e.key === 'Escape') {
                setIsEditing(false)
                setEditName(clip.name)
              }
            }}
          />
        ) : (
          <span
            className="min-w-0 flex-1 cursor-text truncate text-xs font-medium"
            title={`${clip.name} — подвійне клацання для перейменування`}
            onDoubleClick={() => setIsEditing(true)}
          >
            {editName}
          </span>
        )}

        <span
          className="shrink-0 text-xs text-muted-foreground"
          style={{fontFeatureSettings: '"tnum"'}}
        >
          {fmt(clip.buffer.duration)}
        </span>
        <button
          onClick={onMoveUp}
          disabled={index === 0}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent disabled:opacity-25"
          title="Вгору"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={index === totalClips - 1}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent disabled:opacity-25"
          title="Вниз"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
          title="Видалити доріжку"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div style={{background: BG, minHeight: CLIP_HEIGHT}}>
        <canvas
          ref={canvasRef}
          style={{display: 'block', width: '100%', cursor: 'crosshair'}}
          onMouseDown={(e) =>
            onMouseDown(clip.id, getX(e), canvasRef.current.width, visSamples)
          }
          onMouseMove={(e) =>
            onMouseMove(clip.id, getX(e), canvasRef.current.width, visSamples)
          }
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        />
      </div>
    </div>
  )
})
