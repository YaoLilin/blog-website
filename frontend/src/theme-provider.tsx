import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Theme = 'dark' | 'light'
type ThemeMode = 'dark' | 'light' | 'system'

interface ThemeContextType {
  theme: Theme
  themeMode: ThemeMode
  setThemeMode: (themeMode: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const getSystemTheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const savedThemeMode = localStorage.getItem('themeMode') as ThemeMode | null
    const oldTheme = localStorage.getItem('theme') as Theme | null
    if (savedThemeMode === 'light' || savedThemeMode === 'dark' || savedThemeMode === 'system') return savedThemeMode
    if (oldTheme === 'light' || oldTheme === 'dark') return oldTheme
    return 'system'
  })
  const [systemTheme, setSystemTheme] = useState<Theme>(() => getSystemTheme())

  const theme = useMemo<Theme>(() => themeMode === 'system' ? systemTheme : themeMode, [themeMode, systemTheme])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    const root = window.document.documentElement
    root.classList.remove('light', 'dark')
    root.classList.add(theme)
    localStorage.setItem('themeMode', themeMode)
    localStorage.setItem('theme', theme)
  }, [theme, themeMode])

  const toggleTheme = () => {
    setThemeMode(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
