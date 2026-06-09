import {Slider} from '@/components/ui/slider'
import {Label} from '@/components/ui/label'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'

export default function VoiceSettings({
  speed,
  setSpeed,
  stability,
  setStability,
  similarityBoost,
  setSimilarityBoost,
  styleExaggeration,
  setStyleExaggeration,
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-3 rounded-md border border-border bg-background/80 p-4">
        <div className="flex items-center justify-between gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Label
                className="underline decoration-muted-foreground decoration-dotted underline-offset-2"
                htmlFor="speed"
              >
                Швидкість
              </Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Контролює швидкість мовлення. Значення нижче 1.0 сповільнюють,
                вище 1.0 — прискорюють. Екстремальні значення можуть знизити
                якість генерації.
              </p>
            </TooltipContent>
          </Tooltip>
          <span className="text-sm text-muted-foreground">
            {speed.toFixed(2)}
          </span>
        </div>
        <Slider
          id="speed"
          value={[speed]}
          onValueChange={(value) => setSpeed(value[0])}
          min={0.7}
          max={1.2}
          step={0.01}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border bg-background/80 p-4">
        <div className="flex items-center justify-between gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Label
                className="underline decoration-muted-foreground decoration-dotted underline-offset-2"
                htmlFor="stability"
              >
                Стабільність
              </Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Вища стабільність робить голос консистентнішим між
                генераціями, але може звучати монотонно. Для довгих текстів
                рекомендуємо знижувати це значення.
              </p>
            </TooltipContent>
          </Tooltip>
          <span className="text-sm text-muted-foreground">
            {(stability * 100).toFixed()}%
          </span>
        </div>
        <Slider
          id="stability"
          value={[stability]}
          onValueChange={(value) => setStability(value[0])}
          min={0}
          max={1}
          step={0.01}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border bg-background/80 p-4">
        <div className="flex items-center justify-between gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Label
                className="underline decoration-muted-foreground decoration-dotted underline-offset-2"
                htmlFor="similarityBoost"
              >
                Схожість
              </Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Висока схожість покращує чіткість голосу та відповідність
                оригіналу. Дуже високі значення можуть спричинити артефакти.
              </p>
            </TooltipContent>
          </Tooltip>
          <span className="text-sm text-muted-foreground">
            {(similarityBoost * 100).toFixed()}%
          </span>
        </div>
        <Slider
          id="similarityBoost"
          value={[similarityBoost]}
          onValueChange={(value) => setSimilarityBoost(value[0])}
          min={0}
          max={1}
          step={0.01}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border bg-background/80 p-4">
        <div className="flex items-center justify-between gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Label
                className="underline decoration-muted-foreground decoration-dotted underline-offset-2"
                htmlFor="styleExaggeration"
              >
                Стиль
              </Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Високі значення підкреслюють стиль мовлення. Можуть спричинити
                нестабільність генерації. Значення 0.0 — стандартне та значно
                прискорює генерацію.
              </p>
            </TooltipContent>
          </Tooltip>
          <span className="text-sm text-muted-foreground">
            {(styleExaggeration * 100).toFixed()}%
          </span>
        </div>
        <Slider
          id="styleExaggeration"
          value={[styleExaggeration]}
          onValueChange={(value) => setStyleExaggeration(value[0])}
          min={0}
          max={1}
          step={0.01}
        />
      </div>
    </div>
  )
}
