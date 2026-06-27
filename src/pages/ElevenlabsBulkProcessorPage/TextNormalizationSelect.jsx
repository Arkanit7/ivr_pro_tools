import {Label} from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'

export default function TextNormalizationSelect({
  applyTextNormalization,
  setApplyTextNormalization,
}) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label
              className="underline decoration-muted-foreground decoration-dotted underline-offset-2"
              htmlFor="applyTextNormalization"
            >
              Нормалізація тексту
            </Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              Визначає, чи застосовує ElevenLabs нормалізацію тексту.
              «auto» — автоматично, «on» — завжди, «off» — ніколи.
            </p>
          </TooltipContent>
        </Tooltip>
        <span className="text-sm text-muted-foreground capitalize">
          {applyTextNormalization}
        </span>
      </div>
      <Select
        value={applyTextNormalization}
        onValueChange={(value) => setApplyTextNormalization(value)}
      >
        <SelectTrigger
          id="applyTextNormalization"
          aria-label="Text normalization"
        >
          <SelectValue placeholder="Оберіть режим" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="on">on</SelectItem>
          <SelectItem value="off">off</SelectItem>
          <SelectItem value="auto">auto</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
