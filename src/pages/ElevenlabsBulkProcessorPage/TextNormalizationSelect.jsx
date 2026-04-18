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
    <div className="flex flex-col gap-3 rounded-md border border-border bg-background/80 p-4">
      <div className="flex items-center justify-between gap-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Label
              className="underline decoration-muted-foreground decoration-dotted underline-offset-2"
              htmlFor="applyTextNormalization"
            >
              Text Normalization
            </Label>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              Controls whether the ElevenLabs client applies text normalization.
              Use "auto" for automatic behavior, "on" to force normalization, or
              "off" to disable it.
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
          <SelectValue placeholder="Select mode" />
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
