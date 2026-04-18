import {Button, buttonVariants} from '@/components/ui/button'
import {NavLink} from 'react-router'
import {FileSpreadsheet, FileAudio, FileText} from 'lucide-react'
import {cn} from '@/lib/utils'
import {navigationRoutes} from '@/router/navigation'

const navItems = [
  {
    to: navigationRoutes.textNormalizer,
    icon: FileText,
    label: 'Text Normalizer',
  },
  {
    to: navigationRoutes.excelNormalizer,
    icon: FileSpreadsheet,
    label: 'Excel Text Normalizer',
  },
  {
    to: navigationRoutes.elevenlabsBulkProcessor,
    icon: FileAudio,
    label: 'Excel to Voice',
  },
]

function Sidebar() {
  return (
    <div className="flex h-screen w-64 flex-col gap-4 border-r border-border bg-background p-3">
      <p className="pl-2.5 text-lg font-semibold text-foreground">
        IVR Pro Tools
      </p>
      <nav className="">
        <ul className="space-y-0.5">
          {navItems.map(({to, icon: Icon, label}) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({isActive}) =>
                  cn(
                    buttonVariants({
                      variant: isActive ? 'secondary' : 'ghost',
                      size: 'default',
                    }),
                    'w-full justify-start',
                  )
                }
              >
                <Icon className="mr-2 h-4 w-4" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export default Sidebar
