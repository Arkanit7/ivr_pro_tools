import {Button} from '@/components/ui/button'
import {Textarea} from '@/components/ui/textarea'
import {Play, Pause, RotateCcw, Download, Loader2, Wand2} from 'lucide-react'
import {cn} from '@/lib/utils'
import normalizeForTTS from '@/lib/normalizeForTTS'

const VALID_FILENAME_CHAR = /^[a-zA-Z0-9_\-.]$/

function FileNameDisplay({name}) {
  const hasInvalid = [...name].some((c) => !VALID_FILENAME_CHAR.test(c))
  if (!hasInvalid) return <span className="truncate">{name}</span>
  return (
    <span className="font-mono">
      {[...name].map((char, i) => {
        const bad = !VALID_FILENAME_CHAR.test(char)
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
  onDownloadAll,
  onUpdateText,
}) {
  const completedItems = items.filter((item) => item.status === 'complete')
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
                  const normalized = normalizeForTTS(groupItems[0].text)
                  groupItems.forEach((i) => onUpdateText(i.id, normalized))
                })
              }
            >
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              Нормалізувати все
            </Button>
            {completedItems.length > 0 && (
              <Button onClick={onDownloadAll} variant="outline" size="sm">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Завантажити все ({completedItems.length})
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {resolvedGroups.map((groupItems) => {
          const status = getGroupStatus(groupItems)
          const isActive = groupItems.some((i) => i.id === activeAudioId)
          const playableItem = groupItems.find((i) => i.audioUrl)
          const {label, className} = STATUS_CONFIG[status]

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
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5 text-sm font-medium">
                    {groupItems.map((item, i) => (
                      <span key={item.id}>
                        {i > 0 && ', '}
                        <FileNameDisplay name={item.fileName} />
                      </span>
                    ))}
                  </div>
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
                        const normalized = normalizeForTTS(groupItems[0].text)
                        groupItems.forEach((i) => onUpdateText(i.id, normalized))
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
                          variant="ghost"
                          onClick={() => onPlay(playableItem.id)}
                        >
                          {isPlaying && playableItem.id === activeAudioId ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            onDownloadGroup(groupItems.map((i) => i.id))
                          }
                        >
                          <Download className="h-4 w-4" />
                        </Button>
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
