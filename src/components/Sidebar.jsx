import {useState} from 'react'
import {buttonVariants} from '@/components/ui/button'
import {Link, NavLink} from 'react-router'
import {Settings, PanelLeftClose, PanelLeftOpen} from 'lucide-react'
import {cn} from '@/lib/utils'
import {navigationRoutes, navItems} from '@/router/navigation'
import SettingsModal from '@/components/SettingsModal'

function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <>
      <div
        className={cn(
          'sticky top-0 flex h-screen shrink-0 flex-col gap-4 overflow-hidden border-r border-border bg-background p-3 transition-[width] duration-300 ease-in-out',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Header: logo + collapse toggle */}
        <div
          className={cn(
            'flex items-center transition-all duration-300',
            collapsed ? 'justify-center gap-0' : 'gap-1',
          )}
        >
          <Link
            to={navigationRoutes.home}
            className={cn(
              'overflow-hidden pl-2 text-lg font-semibold whitespace-nowrap text-foreground transition-all duration-300',
              collapsed
                ? 'pointer-events-none w-0 max-w-0 pl-0 opacity-0'
                : 'max-w-50 flex-1 opacity-100',
            )}
          >
            IVR Pro Tools{' '}
            <span className="text-xs text-muted-foreground">v3.2</span>
          </Link>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              buttonVariants({variant: 'ghost'}),
              'h-8 w-8 shrink-0 p-0',
            )}
            title={collapsed ? 'Розгорнути панель' : 'Згорнути панель'}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Nav links */}
        <nav>
          <ul className="space-y-0.5">
            {navItems.map(({to, icon: Icon, label}) => (
              <li key={to}>
                <NavLink
                  to={to}
                  title={collapsed ? label : undefined}
                  className={({isActive}) =>
                    cn(
                      buttonVariants({
                        variant: isActive ? 'secondary' : 'ghost',
                      }),
                      'w-full transition-all duration-300',
                      collapsed ? 'justify-center px-0' : 'justify-start',
                    )
                  }
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-[margin] duration-300',
                      collapsed ? 'mr-0' : 'mr-2',
                    )}
                  />
                  <span
                    className={cn(
                      'overflow-hidden whitespace-nowrap transition-all duration-300',
                      collapsed ? 'max-w-0 opacity-0' : 'max-w-50 opacity-100',
                    )}
                  >
                    {label}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Settings */}
        <button
          onClick={() => setSettingsOpen(true)}
          title={collapsed ? 'Налаштування' : undefined}
          className={cn(
            buttonVariants({variant: 'ghost'}),
            'mt-auto w-full transition-all duration-300',
            collapsed ? 'justify-center px-0' : 'justify-start',
          )}
        >
          <Settings
            className={cn(
              'h-4 w-4 shrink-0 transition-[margin] duration-300',
              collapsed ? 'mr-0' : 'mr-2',
            )}
          />
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap transition-all duration-300',
              collapsed ? 'max-w-0 opacity-0' : 'max-w-50 opacity-100',
            )}
          >
            Налаштування
          </span>
        </button>
      </div>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

export default Sidebar
