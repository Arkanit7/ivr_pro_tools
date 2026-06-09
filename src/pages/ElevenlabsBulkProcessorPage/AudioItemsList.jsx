import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {Textarea} from '@/components/ui/textarea'
import {Play, Pause, RotateCcw, Download, Loader2} from 'lucide-react'

function groupByText(items) {
  const map = new Map()
  for (const item of items) {
    const key = item.text
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  }
  return [...map.values()]
}

function getGroupStatus(groupItems) {
  if (groupItems.some((i) => i.status === 'processing')) return 'processing'
  if (groupItems.some((i) => i.status === 'error')) return 'error'
  if (groupItems.some((i) => i.status === 'pending')) return 'pending'
  return 'complete'
}

export default function AudioItemsList({
  items,
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
  const groups = groupByText(items)

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Аудіофайли ({items.length})
          </h3>
          {completedItems.length > 0 && (
            <div className="flex gap-2">
              <Button onClick={onPlayAll} variant="outline">
                <Play className="mr-2 h-4 w-4" />
                Відтворити все
              </Button>
              <Button onClick={onDownloadAll} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Завантажити все ({completedItems.length})
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {groups.map((groupItems) => {
          const status = getGroupStatus(groupItems)
          const isActive = groupItems.some((i) => i.id === activeAudioId)
          const playableItem = groupItems.find((i) => i.audioUrl)
          const fileNames = groupItems.map((i) => i.fileName).join(', ')

          return (
            <Card
              key={groupItems[0].id}
              className={`p-4 transition-colors ${isActive ? 'ring-primary' : ''}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 truncate font-medium" title={fileNames}>
                    {fileNames}
                  </div>
                  <Textarea
                    value={groupItems[0].text}
                    onChange={(e) =>
                      groupItems.forEach((i) =>
                        onUpdateText(i.id, e.target.value),
                      )
                    }
                    className="min-h-20 resize-none"
                    placeholder="Введіть текст для TTS..."
                  />
                </div>

                <div className="flex w-15 shrink-0 flex-col items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      status === 'pending'
                        ? 'bg-muted text-muted-foreground'
                        : status === 'processing'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                          : status === 'complete'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                    }`}
                  >
                    {status === 'pending' && 'Очікує'}
                    {status === 'processing' && 'Обробка'}
                    {status === 'complete' && 'Готово'}
                    {status === 'error' && 'Помилка'}
                  </span>

                  {status === 'complete' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
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
                        variant="outline"
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
                    variant={status === 'processing' ? 'secondary' : 'outline'}
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
            </Card>
          )
        })}
      </div>
    </div>
  )
}
