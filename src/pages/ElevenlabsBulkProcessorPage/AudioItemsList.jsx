import {useState} from 'react'
import {Button} from '@/components/ui/button'
import {Textarea} from '@/components/ui/textarea'
import {Input} from '@/components/ui/input'
import {
  Pencil,
  Play,
  Pause,
  RotateCcw,
  Download,
  Loader2,
  Wand2,
  ChevronDown,
} from 'lucide-react'
import {cn} from '@/lib/utils'
import normalizeForTTS from '@/lib/normalizeForTTS'
import DisabledHint from '@/components/DisabledHint'
import {UNSUPPORTED_HINTS} from '@/lib/elevenlabsModels'
import {
  findConflictingNames,
  getDownloadBlockReason,
  isConflictingName,
  isValidFileName,
  isValidFileNameChar,
} from '@/lib/fileNames'

const NAME_RULES = {allowDot: true}
const isValidChar = (char) => isValidFileNameChar(char, NAME_RULES)

function FileNameDisplay({name}) {
  if (!name) return <span className="text-destructive italic">без назви</span>
  const hasInvalid = [...name].some((c) => !isValidChar(c))
  if (!hasInvalid) return <span className="truncate">{name}</span>
  return (
    <span className="font-mono">
      {[...name].map((char, i) => {
        const bad = !isValidChar(char)
        const display = char === ' ' ? '␣' : char === '\t' ? '⇥' : char
        return bad ? (
          <mark
            key={i}
            className="rounded bg-destructive/20 px-0.5 text-destructive not-italic"
          >
            {display}
          </mark>
        ) : (
          <span key={i}>{char}</span>
        )
      })}
    </span>
  )
}

// Click a name to rename it; Enter or blur saves, Escape cancels.
function FileNameEditor({name, duplicate, onRename}) {
  const [draft, setDraft] = useState(null)
  const invalid = !isValidFileName(name, NAME_RULES)

  if (draft !== null) {
    const commit = () => {
      onRename(draft.trim())
      setDraft(null)
    }
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setDraft(null)
        }}
        aria-invalid={!isValidFileName(draft.trim(), NAME_RULES)}
        aria-label="Назва файлу"
        className="h-7 w-56 font-mono text-sm"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => setDraft(name)}
      title={
        duplicate && !invalid
          ? 'Ця назва вже використовується для іншого промпту — натисніть, щоб перейменувати'
          : 'Натисніть, щоб перейменувати'
      }
      className={cn(
        'inline-flex items-center gap-1 rounded px-1 hover:bg-muted',
        invalid
          ? 'ring-1 ring-destructive/50'
          : duplicate && 'bg-amber-100 ring-1 ring-amber-500/60 dark:bg-amber-900/30',
      )}
    >
      <FileNameDisplay name={name} />
      <Pencil
        className={cn(
          'h-3 w-3 shrink-0',
          invalid
            ? 'text-destructive'
            : duplicate
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-muted-foreground',
        )}
      />
    </button>
  )
}

const STATUS_CONFIG = {
  pending: {label: 'Очікує', className: 'bg-muted text-muted-foreground'},
  processing: {label: 'Обробка', className: 'bg-primary/15 text-primary'},
  complete: {
    label: 'Готово',
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  error: {label: 'Помилка', className: 'bg-destructive/15 text-destructive'},
}

function getGroupStatus(groupItems) {
  if (groupItems.some((i) => i.status === 'processing')) return 'processing'
  if (groupItems.some((i) => i.status === 'error')) return 'error'
  if (groupItems.some((i) => i.status === 'pending')) return 'pending'
  return 'complete'
}

export default function AudioItemsList({
  items,
  groups,
  activeAudioId,
  isPlaying,
  onPlay,
  onRegenerate,
  onDownloadGroup,
  onUpdateText,
  onUpdateContext,
  onRename,
  contextSupported = true,
}) {
  const contextHint = contextSupported ? undefined : UNSUPPORTED_HINTS.context
  const conflictingNames = findConflictingNames(items)
  const [expandedContext, setExpandedContext] = useState(new Set())
  const toggleContext = (id) =>
    setExpandedContext((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const resolvedGroups = groups.map((ids) =>
    ids.map((id) => items.find((i) => i.id === id)).filter(Boolean),
  )

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">
            Аудіофайли ({items.length})
          </h3>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                resolvedGroups.forEach((groupItems) => {
                  const item = groupItems[0]
                  groupItems.forEach((i) => {
                    onUpdateText(i.id, normalizeForTTS(item.text))
                    if (item.textBefore)
                      onUpdateContext(
                        i.id,
                        'textBefore',
                        normalizeForTTS(item.textBefore),
                      )
                    if (item.textAfter)
                      onUpdateContext(
                        i.id,
                        'textAfter',
                        normalizeForTTS(item.textAfter),
                      )
                  })
                })
              }
            >
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              Нормалізувати все
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {resolvedGroups.map((groupItems) => {
          const status = getGroupStatus(groupItems)
          const isActive = groupItems.some((i) => i.id === activeAudioId)
          const playableItem = groupItems.find((i) => i.audioUrl)
          const dirty = groupItems[0].dirty && status === 'complete'
          const {label, className} = dirty
            ? {
                label: 'Є зміни',
                className:
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
              }
            : STATUS_CONFIG[status]
          const downloadBlockReason = getDownloadBlockReason(
            groupItems.map((i) => i.fileName),
            NAME_RULES,
          )

          return (
            <div
              key={groupItems[0].id}
              className={cn(
                'rounded-lg border bg-card p-3 shadow-sm transition-all',
                isActive && isPlaying
                  ? 'card-playing border-primary'
                  : 'border-border',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm font-medium">
                      {groupItems.map((item, i) => (
                        <span key={item.id} className="inline-flex items-center">
                          {i > 0 && <span className="mr-1">,</span>}
                          <FileNameEditor
                            name={item.fileName}
                            duplicate={isConflictingName(item.fileName, conflictingNames)}
                            onRename={(name) => onRename(item.id, name)}
                          />
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => toggleContext(groupItems[0].id)}
                      className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform',
                          expandedContext.has(groupItems[0].id) && 'rotate-180',
                        )}
                      />
                      Контекст
                    </button>
                  </div>

                  {expandedContext.has(groupItems[0].id) && (
                    <DisabledHint hint={contextHint}>
                      <Textarea
                        value={groupItems[0].textBefore ?? ''}
                        onChange={(e) =>
                          groupItems.forEach((i) =>
                            onUpdateContext(i.id, 'textBefore', e.target.value),
                          )
                        }
                        rows={1}
                        className="min-h-9 resize-y text-sm text-muted-foreground"
                        placeholder="Контекст до — не озвучується"
                        disabled={!contextSupported}
                      />
                    </DisabledHint>
                  )}

                  <Textarea
                    value={groupItems[0].text}
                    onChange={(e) =>
                      groupItems.forEach((i) =>
                        onUpdateText(i.id, e.target.value),
                      )
                    }
                    className="min-h-27 resize-y text-sm"
                    placeholder="Введіть текст для TTS..."
                  />

                  {expandedContext.has(groupItems[0].id) && (
                    <DisabledHint hint={contextHint}>
                      <Textarea
                        value={groupItems[0].textAfter ?? ''}
                        onChange={(e) =>
                          groupItems.forEach((i) =>
                            onUpdateContext(i.id, 'textAfter', e.target.value),
                          )
                        }
                        rows={1}
                        className="min-h-9 resize-y text-sm text-muted-foreground"
                        placeholder="Контекст після — не озвучується"
                        disabled={!contextSupported}
                      />
                    </DisabledHint>
                  )}
                </div>

                <div className="flex shrink-0 flex-col items-center gap-1">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
                      className,
                    )}
                  >
                    {label}
                  </span>

                  <div className="grid grid-cols-2 gap-0.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const item = groupItems[0]
                        groupItems.forEach((i) => {
                          onUpdateText(i.id, normalizeForTTS(item.text))
                          if (item.textBefore)
                            onUpdateContext(
                              i.id,
                              'textBefore',
                              normalizeForTTS(item.textBefore),
                            )
                          if (item.textAfter)
                            onUpdateContext(
                              i.id,
                              'textAfter',
                              normalizeForTTS(item.textAfter),
                            )
                        })
                      }}
                      disabled={status === 'processing'}
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>

                    <Button
                      size="sm"
                      variant={status === 'processing' ? 'secondary' : 'ghost'}
                      onClick={() => onRegenerate(groupItems.map((i) => i.id))}
                      disabled={status === 'processing'}
                    >
                      {status === 'processing' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                    </Button>

                    {status === 'complete' && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="col-span-2"
                          onClick={() => onPlay(playableItem.id)}
                        >
                          {isPlaying && playableItem.id === activeAudioId ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <DisabledHint hint={downloadBlockReason}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full"
                            disabled={Boolean(downloadBlockReason)}
                            onClick={() =>
                              onDownloadGroup(groupItems.map((i) => i.id))
                            }
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </DisabledHint>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
