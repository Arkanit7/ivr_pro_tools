import {Button, buttonVariants} from '@/components/ui/button'
import {NavLink} from 'react-router'
import {FileSpreadsheet, FileAudio, FileText} from 'lucide-react'
import {cn} from '@/lib/utils'
import {navigationRoutes} from '@/router/navigation'

function Sidebar() {
  return (
    <nav className="flex min-h-screen">
      <div className="w-64 border-r border-border bg-background p-4">
        <ul className="space-y-2">
          <li>
            <NavLink
              to={navigationRoutes.textNormalizer}
              className={({isActive, isPending}) =>
                cn(
                  buttonVariants({
                    variant: isPending
                      ? 'ghost'
                      : isActive
                        ? 'default'
                        : 'ghost',
                    size: 'default',
                  }),
                  'w-full justify-start',
                )
              }
            >
              <FileText className="mr-2 h-4 w-4" />
              Text Normalizer
            </NavLink>
          </li>
          <li>
            <NavLink
              to={navigationRoutes.excelNormalizer}
              className={({isActive, isPending}) =>
                cn(
                  buttonVariants({
                    variant: isPending
                      ? 'ghost'
                      : isActive
                        ? 'default'
                        : 'ghost',
                    size: 'default',
                  }),
                  'w-full justify-start',
                )
              }
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel Text Normalizer
            </NavLink>
          </li>
          <li>
            <NavLink
              to={navigationRoutes.elevenlabsBulkProcessor}
              className={({isActive, isPending}) =>
                cn(
                  buttonVariants({
                    variant: isPending
                      ? 'ghost'
                      : isActive
                        ? 'default'
                        : 'ghost',
                    size: 'default',
                  }),
                  'w-full justify-start',
                )
              }
            >
              <FileAudio className="mr-2 h-4 w-4" />
              Excel to Voice
            </NavLink>
          </li>
        </ul>
      </div>
    </nav>
  )
}

export default Sidebar
