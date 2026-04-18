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
                Speed
              </Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Controls the speed of the generated speech. Values below 1.0
                will slow down the speech, while values above 1.0 will speed it
                up. Extreme values may affect the quality of the generated
                speech.
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
                Stability
              </Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                Increasing stability will make the voice more consistent between
                re-generations, but it can also make it sounds a bit monotone.
                On longer text fragments we recommend lowering this value.
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
                Similarity Boost
              </Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                High enhancement boosts overall voice clarity and target speaker
                similarity. Very high values can cause artifacts, so adjusting
                this setting to find the optimal value is encouraged.
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
                Style Exaggeration
              </Label>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                High values are recommended if the style of the speech should be
                exaggerated compared to the uploaded audio. Higher values can
                lead to more instability in the generated speech. Setting this
                to 0.0 will greatly increase generation speed and is the default
                setting.
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
