import {Slider} from '@/components/ui/slider'
import {Label} from '@/components/ui/label'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'

function SliderField({id, label, tooltip, value, displayValue, onValueChange, min, max, step}) {
  return (
    <div className="flex flex-col gap-3 p-1.5">
      <div className="flex items-center justify-between gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label
              htmlFor={id}
              className="cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-2"
            >
              {label}
            </Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
        <span className="tabular-nums text-sm text-muted-foreground">{displayValue}</span>
      </div>
      <Slider
        id={id}
        value={[value]}
        onValueChange={([v]) => onValueChange(v)}
        min={min}
        max={max}
        step={step}
      />
    </div>
  )
}

const SLIDERS = [
  {
    id: 'speed',
    label: 'Швидкість',
    tooltip:
      'Контролює швидкість мовлення. Значення нижче 1.0 сповільнюють, вище 1.0 — прискорюють. Екстремальні значення можуть знизити якість генерації.',
    min: 0.7,
    max: 1.2,
    step: 0.01,
    key: 'speed',
    format: (v) => v.toFixed(2),
  },
  {
    id: 'stability',
    label: 'Стабільність',
    tooltip:
      'Вища стабільність робить голос консистентнішим між генераціями, але може звучати монотонно. Для довгих текстів рекомендуємо знижувати це значення.',
    min: 0,
    max: 1,
    step: 0.01,
    key: 'stability',
    format: (v) => `${(v * 100).toFixed()}%`,
  },
  {
    id: 'similarityBoost',
    label: 'Схожість',
    tooltip:
      'Висока схожість покращує чіткість голосу та відповідність оригіналу. Дуже високі значення можуть спричинити артефакти.',
    min: 0,
    max: 1,
    step: 0.01,
    key: 'similarityBoost',
    format: (v) => `${(v * 100).toFixed()}%`,
  },
  {
    id: 'styleExaggeration',
    label: 'Стиль',
    tooltip:
      'Високі значення підкреслюють стиль мовлення. Можуть спричинити нестабільність генерації. Значення 0.0 — стандартне та значно прискорює генерацію.',
    min: 0,
    max: 1,
    step: 0.01,
    key: 'styleExaggeration',
    format: (v) => `${(v * 100).toFixed()}%`,
  },
]

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
  const values = {speed, stability, similarityBoost, styleExaggeration}
  const setters = {
    speed: setSpeed,
    stability: setStability,
    similarityBoost: setSimilarityBoost,
    styleExaggeration: setStyleExaggeration,
  }

  return (
    <div className="space-y-2">
      {SLIDERS.map(({id, label, tooltip, min, max, step, key, format}) => (
        <SliderField
          key={id}
          id={id}
          label={label}
          tooltip={tooltip}
          value={values[key]}
          displayValue={format(values[key])}
          onValueChange={setters[key]}
          min={min}
          max={max}
          step={step}
        />
      ))}
    </div>
  )
}
