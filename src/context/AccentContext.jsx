import {createContext, useContext, useEffect} from 'react'
import {useLocalStorage} from '@/hooks/useLocalStorage'

export const ACCENT_COLORS = [
  {id: 'default', label: 'За замовчуванням', preview: 'oklch(0.205 0 0)'},
  {id: 'blue',    label: 'Синій',             preview: 'oklch(0.46 0.22 250)'},
  {id: 'purple',  label: 'Фіолетовий',        preview: 'oklch(0.46 0.22 300)'},
  {id: 'teal',    label: 'Бірюзовий',         preview: 'oklch(0.46 0.18 195)'},
  {id: 'green',   label: 'Зелений',           preview: 'oklch(0.46 0.18 150)'},
  {id: 'orange',  label: 'Помаранчевий',      preview: 'oklch(0.56 0.2 50)'},
  {id: 'yellow',  label: 'Жовтий',            preview: 'hsl(48 100% 46%)'},
  {id: 'red',     label: 'Червоний',          preview: 'oklch(0.5 0.22 25)'},
]

const AccentContext = createContext(null)

export function AccentProvider({children}) {
  const [accent, setAccent] = useLocalStorage('accentColor', 'default')
  const [customColor, setCustomColor] = useLocalStorage('accentCustomColor', '#6d28d9')

  useEffect(() => {
    const root = document.documentElement
    let styleEl = document.getElementById('__accent_custom__')

    if (accent === 'custom') {
      delete root.dataset.accent
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = '__accent_custom__'
        document.head.appendChild(styleEl)
      }
      // :root.dark (specificity 0,2,0) beats both :root and .dark (0,1,0 each),
      // so the custom colour wins in both light and dark modes.
      styleEl.textContent = [
        `:root { --primary: ${customColor}; --ring: ${customColor}; }`,
        `:root.dark { --primary: ${customColor}; --ring: ${customColor}; }`,
      ].join('\n')
    } else {
      if (styleEl) styleEl.textContent = ''
      if (accent === 'default') {
        delete root.dataset.accent
      } else {
        root.dataset.accent = accent
      }
    }
  }, [accent, customColor])

  return (
    <AccentContext.Provider value={{accent, setAccent, customColor, setCustomColor}}>
      {children}
    </AccentContext.Provider>
  )
}

export function useAccent() {
  const ctx = useContext(AccentContext)
  if (!ctx) throw new Error('useAccent must be used within AccentProvider')
  return ctx
}
