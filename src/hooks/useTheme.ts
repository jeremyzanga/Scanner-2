import { useCallback, useEffect, useState } from 'react'
import { loadTheme, saveTheme, ThemePreference } from '../lib/storage'

export function useTheme() {
  const [theme, setTheme] = useState<ThemePreference>(() => loadTheme())

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    saveTheme(theme)
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle, setTheme }
}
