'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Theme, PRESET_THEMES, applyTheme, loadThemePreference, saveThemePreference, getThemeById } from '@/lib/themes'

interface ThemeContextType {
  currentTheme: Theme
  setTheme: (themeId: string) => void
  availableThemes: Theme[]
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function CustomThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(PRESET_THEMES[0])

  useEffect(() => {
    // Load saved theme preference
    const savedThemeId = loadThemePreference()
    const theme = getThemeById(savedThemeId) || PRESET_THEMES[0]
    setCurrentTheme(theme)
    applyTheme(theme)
  }, [])

  const setTheme = (themeId: string) => {
    const theme = getThemeById(themeId)
    if (theme) {
      setCurrentTheme(theme)
      applyTheme(theme)
      saveThemePreference(themeId)
    }
  }

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        setTheme,
        availableThemes: PRESET_THEMES,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useCustomTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useCustomTheme must be used within a CustomThemeProvider')
  }
  return context
}
