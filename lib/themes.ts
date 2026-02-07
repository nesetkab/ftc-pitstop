/**
 * Theme System for FTC Pitstop
 * Provides customizable color schemes with presets
 */

export interface Theme {
  id: string
  name: string
  colors: {
    // Background colors
    background: string
    backgroundSecondary: string
    backgroundTertiary: string

    // Text colors
    text: string
    textSecondary: string
    textMuted: string

    // Primary colors
    primary: string
    primaryHover: string
    primaryText: string

    // Accent colors
    accent: string
    accentHover: string

    // Border colors
    border: string
    borderHover: string

    // Status colors
    success: string
    warning: string
    error: string
    info: string

    // Card/surface colors
    card: string
    cardHover: string

    // Special colors (preserved for branding)
    red1: string
    red2: string
    blue1: string
    blue2: string
  }
}

export const PRESET_THEMES: Theme[] = [
  {
    id: 'default',
    name: 'Default Dark',
    colors: {
      background: '#121218',
      backgroundSecondary: '#1a1a24',
      backgroundTertiary: '#22222e',

      text: '#e0e0ec',
      textSecondary: '#9898aa',
      textMuted: '#6e6e82',

      primary: '#e0e0ec',
      primaryHover: '#c8c8d8',
      primaryText: '#121218',

      accent: '#1e1e2a',
      accentHover: '#2a2a38',

      border: '#2a2a38',
      borderHover: '#3a3a4a',

      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',

      card: '#16161e',
      cardHover: '#1e1e2a',

      red1: '#dc2626',
      red2: '#ef4444',
      blue1: '#2563eb',
      blue2: '#3b82f6',
    },
  },
  {
    id: 'light',
    name: 'Light Mode',
    colors: {
      background: '#ffffff',
      backgroundSecondary: '#f9fafb',
      backgroundTertiary: '#f3f4f6',

      text: '#111827',
      textSecondary: '#4b5563',
      textMuted: '#6b7280',

      primary: '#2563eb',
      primaryHover: '#1d4ed8',
      primaryText: '#ffffff',

      accent: '#7c3aed',
      accentHover: '#6d28d9',

      border: '#e5e7eb',
      borderHover: '#d1d5db',

      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',

      card: '#ffffff',
      cardHover: '#f9fafb',

      red1: '#dc2626',
      red2: '#ef4444',
      blue1: '#2563eb',
      blue2: '#3b82f6',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean Blue',
    colors: {
      background: '#0a192f',
      backgroundSecondary: '#112240',
      backgroundTertiary: '#1a2f4a',

      text: '#e6f1ff',
      textSecondary: '#8892b0',
      textMuted: '#64748b',

      primary: '#0ea5e9',
      primaryHover: '#38bdf8',
      primaryText: '#ffffff',

      accent: '#06b6d4',
      accentHover: '#22d3ee',

      border: '#1e3a5f',
      borderHover: '#2d4f7c',

      success: '#10b981',
      warning: '#f59e0b',
      error: '#f87171',
      info: '#38bdf8',

      card: '#162544',
      cardHover: '#1e3456',

      red1: '#ef4444',
      red2: '#f87171',
      blue1: '#0ea5e9',
      blue2: '#38bdf8',
    },
  },
  {
    id: 'forest',
    name: 'Forest Green',
    colors: {
      background: '#0f1e13',
      backgroundSecondary: '#1a2e1f',
      backgroundTertiary: '#243b2a',

      text: '#e8f5e9',
      textSecondary: '#a5d6a7',
      textMuted: '#81c784',

      primary: '#22c55e',
      primaryHover: '#4ade80',
      primaryText: '#ffffff',

      accent: '#10b981',
      accentHover: '#34d399',

      border: '#2d5233',
      borderHover: '#3a6b42',

      success: '#22c55e',
      warning: '#fbbf24',
      error: '#ef4444',
      info: '#06b6d4',

      card: '#1e3526',
      cardHover: '#2a4434',

      red1: '#ef4444',
      red2: '#f87171',
      blue1: '#3b82f6',
      blue2: '#60a5fa',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset Orange',
    colors: {
      background: '#1f1410',
      backgroundSecondary: '#2a1f1a',
      backgroundTertiary: '#3a2a20',

      text: '#fff7ed',
      textSecondary: '#fed7aa',
      textMuted: '#fdba74',

      primary: '#f97316',
      primaryHover: '#fb923c',
      primaryText: '#ffffff',

      accent: '#ea580c',
      accentHover: '#f97316',

      border: '#4a3228',
      borderHover: '#5c3e32',

      success: '#10b981',
      warning: '#fbbf24',
      error: '#dc2626',
      info: '#3b82f6',

      card: '#2d2218',
      cardHover: '#3d2f24',

      red1: '#dc2626',
      red2: '#ef4444',
      blue1: '#2563eb',
      blue2: '#3b82f6',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Purple',
    colors: {
      background: '#0f0a1e',
      backgroundSecondary: '#1a1229',
      backgroundTertiary: '#251b35',

      text: '#f3e8ff',
      textSecondary: '#d8b4fe',
      textMuted: '#c084fc',

      primary: '#a855f7',
      primaryHover: '#c084fc',
      primaryText: '#ffffff',

      accent: '#8b5cf6',
      accentHover: '#a78bfa',

      border: '#3b2656',
      borderHover: '#4c3268',

      success: '#10b981',
      warning: '#fbbf24',
      error: '#ef4444',
      info: '#60a5fa',

      card: '#1e1333',
      cardHover: '#2b1d45',

      red1: '#dc2626',
      red2: '#f87171',
      blue1: '#3b82f6',
      blue2: '#60a5fa',
    },
  },
  {
    id: 'cherry',
    name: 'Cherry Red',
    colors: {
      background: '#1f0a0a',
      backgroundSecondary: '#2a1414',
      backgroundTertiary: '#3a1f1f',

      text: '#fee2e2',
      textSecondary: '#fca5a5',
      textMuted: '#f87171',

      primary: '#dc2626',
      primaryHover: '#ef4444',
      primaryText: '#ffffff',

      accent: '#991b1b',
      accentHover: '#b91c1c',

      border: '#4a2020',
      borderHover: '#5c2828',

      success: '#10b981',
      warning: '#fbbf24',
      error: '#dc2626',
      info: '#3b82f6',

      card: '#2d1616',
      cardHover: '#3d2020',

      red1: '#b91c1c',
      red2: '#dc2626',
      blue1: '#1e40af',
      blue2: '#2563eb',
    },
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    colors: {
      background: '#000000',
      backgroundSecondary: '#0a0a0a',
      backgroundTertiary: '#1a1a1a',

      text: '#ffffff',
      textSecondary: '#e5e5e5',
      textMuted: '#a3a3a3',

      primary: '#ffffff',
      primaryHover: '#e5e5e5',
      primaryText: '#000000',

      accent: '#fbbf24',
      accentHover: '#fcd34d',

      border: '#404040',
      borderHover: '#525252',

      success: '#22c55e',
      warning: '#fbbf24',
      error: '#ef4444',
      info: '#3b82f6',

      card: '#0f0f0f',
      cardHover: '#1f1f1f',

      red1: '#ef4444',
      red2: '#f87171',
      blue1: '#3b82f6',
      blue2: '#60a5fa',
    },
  },
]

export function applyTheme(theme: Theme) {
  const root = document.documentElement

  // Apply custom theme variables
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${camelToKebab(key)}`, value)
  })

  // Also update shadcn/ui variables to match theme
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255
    g /= 255
    b /= 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0
    let s = 0
    let l = (max + min) / 2

    if (max === min) {
      h = s = 0 // achromatic
    } else {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0)
          break
        case g:
          h = (b - r) / d + 2
          break
        case b:
          h = (r - g) / d + 4
          break
      }
      h /= 6
    }

    h = Math.round(h * 360)
    s = Math.round(s * 100)
    l = Math.round(l * 100)

    return `${h} ${s}% ${l}%`
  }

  // Map theme colors to shadcn variables
  // Convert hex colors to HSL for shadcn's hsl format
  root.style.setProperty('--background', rgbToHsl(hexToRgb(theme.colors.background)!.r, hexToRgb(theme.colors.background)!.g, hexToRgb(theme.colors.background)!.b))
  root.style.setProperty('--foreground', rgbToHsl(hexToRgb(theme.colors.text)!.r, hexToRgb(theme.colors.text)!.g, hexToRgb(theme.colors.text)!.b))
  root.style.setProperty('--card', rgbToHsl(hexToRgb(theme.colors.card)!.r, hexToRgb(theme.colors.card)!.g, hexToRgb(theme.colors.card)!.b))
  root.style.setProperty('--card-foreground', rgbToHsl(hexToRgb(theme.colors.text)!.r, hexToRgb(theme.colors.text)!.g, hexToRgb(theme.colors.text)!.b))
  root.style.setProperty('--popover', rgbToHsl(hexToRgb(theme.colors.card)!.r, hexToRgb(theme.colors.card)!.g, hexToRgb(theme.colors.card)!.b))
  root.style.setProperty('--popover-foreground', rgbToHsl(hexToRgb(theme.colors.text)!.r, hexToRgb(theme.colors.text)!.g, hexToRgb(theme.colors.text)!.b))
  root.style.setProperty('--primary', rgbToHsl(hexToRgb(theme.colors.primary)!.r, hexToRgb(theme.colors.primary)!.g, hexToRgb(theme.colors.primary)!.b))
  root.style.setProperty('--primary-foreground', rgbToHsl(hexToRgb(theme.colors.primaryText)!.r, hexToRgb(theme.colors.primaryText)!.g, hexToRgb(theme.colors.primaryText)!.b))
  root.style.setProperty('--secondary', rgbToHsl(hexToRgb(theme.colors.backgroundSecondary)!.r, hexToRgb(theme.colors.backgroundSecondary)!.g, hexToRgb(theme.colors.backgroundSecondary)!.b))
  root.style.setProperty('--secondary-foreground', rgbToHsl(hexToRgb(theme.colors.text)!.r, hexToRgb(theme.colors.text)!.g, hexToRgb(theme.colors.text)!.b))
  root.style.setProperty('--muted', rgbToHsl(hexToRgb(theme.colors.backgroundSecondary)!.r, hexToRgb(theme.colors.backgroundSecondary)!.g, hexToRgb(theme.colors.backgroundSecondary)!.b))
  root.style.setProperty('--muted-foreground', rgbToHsl(hexToRgb(theme.colors.textMuted)!.r, hexToRgb(theme.colors.textMuted)!.g, hexToRgb(theme.colors.textMuted)!.b))
  root.style.setProperty('--accent', rgbToHsl(hexToRgb(theme.colors.accent)!.r, hexToRgb(theme.colors.accent)!.g, hexToRgb(theme.colors.accent)!.b))
  root.style.setProperty('--accent-foreground', rgbToHsl(hexToRgb(theme.colors.primaryText)!.r, hexToRgb(theme.colors.primaryText)!.g, hexToRgb(theme.colors.primaryText)!.b))
  root.style.setProperty('--destructive', rgbToHsl(hexToRgb(theme.colors.error)!.r, hexToRgb(theme.colors.error)!.g, hexToRgb(theme.colors.error)!.b))
  root.style.setProperty('--destructive-foreground', rgbToHsl(hexToRgb(theme.colors.primaryText)!.r, hexToRgb(theme.colors.primaryText)!.g, hexToRgb(theme.colors.primaryText)!.b))
  root.style.setProperty('--border', rgbToHsl(hexToRgb(theme.colors.border)!.r, hexToRgb(theme.colors.border)!.g, hexToRgb(theme.colors.border)!.b))
  root.style.setProperty('--input', rgbToHsl(hexToRgb(theme.colors.border)!.r, hexToRgb(theme.colors.border)!.g, hexToRgb(theme.colors.border)!.b))
  root.style.setProperty('--ring', rgbToHsl(hexToRgb(theme.colors.primary)!.r, hexToRgb(theme.colors.primary)!.g, hexToRgb(theme.colors.primary)!.b))
}

function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

export function getThemeById(id: string): Theme | undefined {
  return PRESET_THEMES.find(theme => theme.id === id)
}

export function saveThemePreference(themeId: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('ftc-pitstop-theme', themeId)
  }
}

export function loadThemePreference(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('ftc-pitstop-theme') || 'default'
  }
  return 'default'
}
