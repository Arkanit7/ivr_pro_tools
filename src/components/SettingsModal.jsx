import {useEffect} from 'react'
import {Sun, Monitor, Moon, X} from 'lucide-react'
import {cn} from '@/lib/utils'
import {useTheme} from '@/context/ThemeContext'

const THEMES = [
  {value: 'light', icon: Sun, label: 'Світла'},
  {value: 'system', icon: Monitor, label: 'Система'},
  {value: 'dark', icon: Moon, label: 'Темна'},
]

function SettingsModal({onClose}) {
  const {theme, setTheme} = useTheme()

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="relative z-10 w-80 animate-in fade-in zoom-in-95 duration-200">
        <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-card-foreground">Налаштування</h2>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Закрити"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Тема оформлення
              </p>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted">
                {THEMES.map(({value, icon: Icon, label}) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg text-xs font-medium transition-all duration-200 select-none',
                      theme === value
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
