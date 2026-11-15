import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'
import {Label} from '@/components/ui/label'
import {cn} from '@/lib/utils'
import {useElevenLabsUsage} from '@/lib/elevenlabsUsage'

const fmt = (n) => n.toLocaleString('uk-UA')

function usageDetails(usage) {
  if (usage.status === 'ok') {
    const left = Math.max(usage.limit - usage.used, 0)
    return [
      `Використано ${fmt(usage.used)} з ${fmt(usage.limit)} кредитів`,
      `Залишилось ${fmt(left)}`,
      usage.resetAt &&
        `Оновлення ліміту: ${usage.resetAt.toLocaleDateString('uk-UA', {day: 'numeric', month: 'long'})}`,
    ].filter(Boolean)
  }
  if (usage.status === 'error' && usage.reason === 'permission')
    return [
      'Ключ API не має дозволу «User → Access».',
      'Увімкніть його в налаштуваннях ключа на elevenlabs.io, щоб бачити використання кредитів.',
    ]
  if (usage.status === 'error')
    return ['Не вдалося отримати дані про кредити.', usage.message]
  return ['Завантаження даних про кредити…']
}

export default function CreditsMeter() {
  const usage = useElevenLabsUsage()
  if (usage.status === 'disabled') return null

  const ok = usage.status === 'ok'
  const percent = ok
    ? usage.limit > 0
      ? Math.min(100, (usage.used / usage.limit) * 100)
      : 100
    : 0

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          role="meter"
          aria-label="Використання кредитів ElevenLabs"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={ok ? Math.round(percent) : undefined}
          className="flex cursor-help flex-col gap-2 rounded-md p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <div className="flex items-center justify-between gap-4">
            <Label className="cursor-help underline decoration-muted-foreground decoration-dotted underline-offset-2">
              Кредити
            </Label>
            <span className="text-sm text-muted-foreground tabular-nums">
              {ok ? `${Math.round(percent)}%` : '—'}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-500',
                percent >= 95
                  ? 'bg-destructive'
                  : percent >= 80
                    ? 'bg-amber-500'
                    : 'bg-primary',
              )}
              style={{width: `${percent}%`}}
            />
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-0.5">
          {usageDetails(usage).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
