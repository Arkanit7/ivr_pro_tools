import {Button} from '@/components/ui/button'
import {Textarea} from '@/components/ui/textarea'
import {Play, Pause, RotateCcw, Download, Loader2} from 'lucide-react'
import {cn} from '@/lib/utils'

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
  onPlayAll,
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
          {completedItems.length > 0 && (
            <div className="flex gap-2">
              <Button onClick={onPlayAll} variant="outline" size="sm">
                <Play className="mr-1.5 h-3.5 w-3.5" />
                Відтворити все
              </Button>
              <Button onClick={onDownloadAll} variant="outline" size="sm">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Завантажити все ({completedItems.length})
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="divide-y divide-border">
        {resolvedGroups.map((groupItems) => {
          const status = getGroupStatus(groupItems)
          const isActive = groupItems.some((i) => i.id === activeAudioId)
          const playableItem = groupItems.find((i) => i.audioUrl)
          const fileNames = groupItems.map((i) => i.fileName).join(', ')
          const {label, className} = STATUS_CONFIG[status]

          return (
            <div
              key={groupItems[0].id}
              className={cn(
                'py-2 transition-colors',
                isActive && 'bg-primary/5',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div
                    className="mb-0.5 truncate text-sm font-medium"
                    title={fileNames}
                  >
                    {fileNames}
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

                <div className="flex w-14 shrink-0 flex-col items-center gap-1">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium',
                      className,
                    )}
                  >
                    {label}
                  </span>

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
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
