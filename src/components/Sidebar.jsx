import {useState} from 'react'
import {buttonVariants} from '@/components/ui/button'
import {Link, NavLink} from 'react-router'
import {Settings} from 'lucide-react'
import {cn} from '@/lib/utils'
import {navigationRoutes, navItems} from '@/router/navigation'
import SettingsModal from '@/components/SettingsModal'

function Sidebar() {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <div className="sticky top-0 flex h-screen w-64 flex-col gap-4 border-r border-border bg-background p-3">
        <Link
          to={navigationRoutes.home}
          className="pl-2.5 text-lg font-semibold text-foreground"
        >
          IVR Pro Tools{' '}
          <span className="text-xs text-muted-foreground">v3.1</span>
        </Link>

        <nav>
          <ul className="space-y-0.5">
            {navItems.map(({to, icon: Icon, label}) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({isActive}) =>
                    cn(
                      buttonVariants({
                        variant: isActive ? 'secondary' : 'ghost',
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

        <button
          onClick={() => setSettingsOpen(true)}
          className={cn(
            buttonVariants({variant: 'ghost'}),
            'mt-auto w-full justify-start',
          )}
        >
          <Settings className="mr-2 h-4 w-4" />
          Налаштування
        </button>
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

export default Sidebar
