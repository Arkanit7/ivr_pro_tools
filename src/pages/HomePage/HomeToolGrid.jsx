import {FileText, FileSpreadsheet, FileAudio} from 'lucide-react'
import {Link} from 'react-router'
import {Button} from '@/components/ui/button'
import {navigationRoutes} from '@/router/navigation'

const navItems = [
  {
    to: navigationRoutes.textNormalizer,
    icon: FileText,
    label: 'Text Normalizer',
    variant: 'default',
  },
  {
    to: navigationRoutes.excelNormalizer,
    icon: FileSpreadsheet,
    label: 'Excel Normalizer',
    variant: 'secondary',
  },
  {
    to: navigationRoutes.elevenlabsBulkProcessor,
    icon: FileAudio,
    label: 'Excel to Voice',
    variant: 'ghost',
  },
]

export default function HomeToolGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {navItems.map(({to, icon: Icon, label, variant}) => (
        <Button
          key={to}
          asChild
          className="w-full justify-start gap-2"
          variant={variant}
        >
          <Link to={to}>
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        </Button>
      ))}
    </div>
  )
}
