import {Link} from 'react-router'
import {Button} from '@/components/ui/button'
import {FileText, FileSpreadsheet, FileAudio} from 'lucide-react'
import {navigationRoutes} from '@/router/navigation'

export default function HomePage() {
  return (
    <div className="flex min-h-full items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-4xl space-y-10 rounded-3xl border border-border bg-card p-10 shadow-sm">
        <div className="space-y-4 text-center">
          <p className="text-sm tracking-[0.35em] text-muted-foreground uppercase">
            Welcome to
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground">
            IVR Pro Tools
          </h1>
          <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground">
            A lightweight utility suite for normalizing text, preparing Excel
            content, and generating audio-friendly output.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Button asChild className="w-full justify-start gap-2">
            <Link to={navigationRoutes.textNormalizer}>
              <FileText className="h-4 w-4" />
              Text Normalizer
            </Link>
          </Button>
          <Button asChild className="w-full justify-start gap-2">
            <Link to={navigationRoutes.excelNormalizer}>
              <FileSpreadsheet className="h-4 w-4" />
              Excel Normalizer
            </Link>
          </Button>
          <Button asChild className="w-full justify-start gap-2">
            <Link to={navigationRoutes.elevenlabsBulkProcessor}>
              <FileAudio className="h-4 w-4" />
              Excel to Voice
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
