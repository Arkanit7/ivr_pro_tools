import {useEffect} from 'react'
import {Sun, Monitor, Moon, X} from 'lucide-react'
import {cn} from '@/lib/utils'
import {useTheme} from '@/context/ThemeContext'
import {Button} from '@/components/ui/button'

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
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-card-foreground">Налаштування</h2>
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Закрити">
              <X />
            </Button>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Тема оформлення
              </p>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                {THEMES.map(({value, icon: Icon, label}) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 select-none rounded-lg px-2 py-3 text-xs font-medium transition-all duration-200',
                      theme === value
                        ? 'bg-background text-foreground shadow-sm'
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
