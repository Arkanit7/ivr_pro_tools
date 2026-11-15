import {Button} from '@/components/ui/button'
import {Play, Loader2, Download, RotateCcw} from 'lucide-react'

export default function GenerateButton({
  status,
  progress,
  file,
  completedCount,
  onClick,
  onDownloadAll,
}) {
  const busy = status === 'processing' || status === 'testing'

  // Once the pack is ready, downloading is the main action; regenerating spends credits.
  if (status === 'complete' && completedCount > 0) {
    return (
      <div className="flex gap-2">
        <Button className="h-12 flex-1 text-lg" onClick={onDownloadAll}>
          <Download className="mr-2 h-6 w-6" /> Завантажити все ({completedCount})
        </Button>
        <Button
          variant="outline"
          className="h-12 px-4"
          disabled={!file}
          onClick={() => {
            if (window.confirm('Перегенерувати всі промпти? Це знову витратить кредити ElevenLabs.'))
              onClick()
          }}
        >
          <RotateCcw className="mr-2 h-4 w-4" /> Перегенерувати все
        </Button>
      </div>
    )
  }

  return (
    <Button
      className="h-12 w-full text-lg"
      disabled={busy || !file}
      onClick={onClick}
    >
      {status === 'processing' ? (
        <>
          <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Обробка{' '}
          {progress.current}/{progress.total}
        </>
      ) : (
        <>
          <Play className="mr-2 h-6 w-6 fill-current" /> Генерувати всі промпти
        </>
      )}
    </Button>
  )
}
