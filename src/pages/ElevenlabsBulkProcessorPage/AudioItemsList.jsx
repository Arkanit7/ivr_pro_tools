import {Button} from '@/components/ui/button'
import {Card} from '@/components/ui/card'
import {Textarea} from '@/components/ui/textarea'
import {Play, RotateCcw, Download, Loader2} from 'lucide-react'

export default function AudioItemsList({
  items,
  activeAudioId,
  onPlay,
  onRegenerate,
  onDownloadIndividual,
  onDownloadAll,
  onUpdateText,
}) {
  const handleTextChange = (itemId, newText) => {
    if (newText.trim() || newText === '') {
      onUpdateText(itemId, newText)
    }
  }

  const completedItems = items.filter((item) => item.status === 'complete')

  return (
    <div className="space-y-4">
      {items.length > 0 && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            Audio Items ({items.length})
          </h3>
          {completedItems.length > 0 && (
            <Button onClick={onDownloadAll} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download All ({completedItems.length})
            </Button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <Card
            key={item.id}
            className={`p-4 transition-colors ${item.id === activeAudioId ? 'ring-primary' : ''}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-1 truncate font-medium">{item.fileName}</div>
                <Textarea
                  value={item.text}
                  onChange={(e) => handleTextChange(item.id, e.target.value)}
                  className="min-h-20 resize-none"
                  placeholder="Enter text for TTS..."
                />
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {item.status === 'complete' && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPlay(item.id)}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDownloadIndividual(item.id)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </>
                )}

                <Button
                  size="sm"
                  variant={
                    item.status === 'processing' ? 'secondary' : 'outline'
                  }
                  onClick={() => onRegenerate(item.id)}
                  disabled={item.status === 'processing'}
                >
                  {item.status === 'processing' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                </Button>

                <div className="min-w-15 text-right text-xs text-muted-foreground">
                  {item.status === 'pending' && 'Pending'}
                  {item.status === 'processing' && 'Processing'}
                  {item.status === 'complete' && 'Ready'}
                  {item.status === 'error' && 'Error'}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
