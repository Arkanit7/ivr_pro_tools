import {createContext, useContext, useEffect} from 'react'
import {useLocalStorage} from '@/hooks/useLocalStorage'

const ThemeContext = createContext(null)

export function ThemeProvider({children}) {
  const [theme, setTheme] = useLocalStorage('theme', 'system')

  useEffect(() => {
    const root = document.documentElement

    const apply = (dark) => root.classList.toggle('dark', dark)

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
      const handler = (e) => apply(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }

    apply(theme === 'dark')
  }, [theme])

  return <ThemeContext.Provider value={{theme, setTheme}}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
