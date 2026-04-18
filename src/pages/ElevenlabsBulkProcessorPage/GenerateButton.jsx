import {Button} from '@/components/ui/button'
import {Play, Loader2, Download} from 'lucide-react'

export default function GenerateButton({status, progress, file, onClick}) {
  return (
    <Button
      className="h-12 w-full text-lg"
      disabled={status === 'processing' || status === 'testing' || !file}
      onClick={onClick}
    >
      {status === 'processing' ? (
        <>
          <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Processing{' '}
          {progress.current}/{progress.total}
        </>
      ) : status === 'complete' ? (
        <>
          <Download className="mr-2 h-6 w-6" /> Re-generate Pack
        </>
      ) : (
        <>
          <Play className="mr-2 h-6 w-6 fill-current" /> Generate All Prompts
        </>
      )}
    </Button>
  )
}
