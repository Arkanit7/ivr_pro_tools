import {useEffect} from 'react'
import {Sun, Monitor, Moon, X} from 'lucide-react'
import {cn} from '@/lib/utils'
import {useTheme} from '@/context/ThemeContext'
import {useAccent, ACCENT_COLORS} from '@/context/AccentContext'
import {Button} from '@/components/ui/button'

const THEMES = [
  {value: 'light', icon: Sun, label: 'Світла'},
  {value: 'system', icon: Monitor, label: 'Система'},
  {value: 'dark', icon: Moon, label: 'Темна'},
]

function SettingsModal({onClose}) {
  const {theme, setTheme} = useTheme()
  const {accent, setAccent, customColor, setCustomColor} = useAccent()

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
        className="absolute inset-0 animate-in bg-black/30 backdrop-blur-sm duration-200 fade-in"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-lg animate-in px-4 duration-200 zoom-in-95 fade-in">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-card-foreground">
              Налаштування
            </h2>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Закрити"
            >
              <X />
            </Button>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div>
              <p className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Тема оформлення
              </p>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                {THEMES.map(({value, icon: Icon, label}) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-lg px-2 py-3 text-xs font-medium transition-all duration-200 select-none',
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

            <div>
              <p className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Акцентний колір
              </p>
              <div className="flex flex-wrap gap-2">
                {ACCENT_COLORS.map(({id, label, preview}) => (
                  <button
                    key={id}
                    title={label}
                    onClick={() => setAccent(id)}
                    style={{backgroundColor: preview}}
                    className={cn(
                      'h-7 w-7 rounded-full transition-all',
                      accent === id
                        ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                        : 'hover:scale-110',
                    )}
                  />
                ))}

                {/* Native colour picker — styled as a swatch circle */}
                <label
                  title="Власний колір"
                  style={{backgroundColor: customColor}}
                  onClick={() => setAccent('custom')}
                  className={cn(
                    'relative h-7 w-7 cursor-pointer overflow-hidden rounded-full transition-all',
                    accent === 'custom'
                      ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background'
                      : 'hover:scale-110',
                  )}
                >
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
