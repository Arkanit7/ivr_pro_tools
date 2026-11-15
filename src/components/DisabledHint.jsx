import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/ui/tooltip'

// Disabled controls don't receive pointer events, so the tooltip sits on a wrapper.
export default function DisabledHint({hint, children}) {
  if (!hint) return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-not-allowed">{children}</div>
      </TooltipTrigger>
      <TooltipContent>
        <p>{hint}</p>
      </TooltipContent>
    </Tooltip>
  )
}
