import {Button, buttonVariants} from '@/components/ui/button'
import {Link, NavLink} from 'react-router'
import {FileSpreadsheet, FileAudio, FileText} from 'lucide-react'
import {cn} from '@/lib/utils'
import {navigationRoutes} from '@/router/navigation'

const navItems = [
  {
    to: navigationRoutes.textNormalizer,
    icon: FileText,
    label: 'Нормалізатор тексту',
  },
  {
    to: navigationRoutes.excelNormalizer,
    icon: FileSpreadsheet,
    label: 'Нормалізатор Excel',
  },
  {
    to: navigationRoutes.elevenlabsBulkProcessor,
    icon: FileAudio,
    label: 'Excel у голос',
  },
]

function Sidebar() {
  return (
    <div className="sticky top-0 flex h-screen w-64 flex-col gap-4 border-r border-border bg-background p-3">
      <Link
        to={navigationRoutes.home}
        className="pl-2.5 text-lg font-semibold text-foreground"
      >
        IVR Pro Tools{' '}
        <span className="text-xs text-muted-foreground">v2.1</span>
      </Link>
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
