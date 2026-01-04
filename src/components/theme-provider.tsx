import * as React from 'react'

type Theme = 'dark' | 'light' | 'system'

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeProviderContext = React.createContext<
  ThemeProviderState | undefined
>(undefined)

/**
 * Applies the resolved theme class to the document root.
 * Note: Initial theme is set via inline script in __root.tsx to prevent flash.
 * This effect handles theme changes after hydration and system preference changes.
 */
function applyTheme(theme: Theme) {
  const root = window.document.documentElement
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolvedTheme =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  root.classList.remove('light', 'dark')
  root.classList.add(resolvedTheme)
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return defaultTheme
    }
    return (localStorage.getItem(storageKey) as Theme | null) || defaultTheme
  })

  // Apply theme on change and listen for system preference changes
  React.useEffect(() => {
    applyTheme(theme)

    // Only listen for system changes when theme is 'system'
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme(theme)

      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme)
      setTheme(newTheme)
    },
  }

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider')

  return context
}
