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
      background: '#000000',
      backgroundSecondary: '#0a0a0a',
      backgroundTertiary: '#1a1a1a',

      text: '#f9fafb',
      textSecondary: '#d1d5db',
      textMuted: '#9ca3af',

      primary: '#3b82f6',
      primaryHover: '#60a5fa',
      primaryText: '#ffffff',

      accent: '#8b5cf6',
      accentHover: '#a78bfa',

      border: '#27272a',
      borderHover: '#3f3f46',

      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',

      card: '#18181b',
      cardHover: '#27272a',

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
  // Convert hex colors to RGB for shadcn's hsl format
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  // Map theme colors to shadcn variables
  root.style.setProperty('--background', theme.colors.background)
  root.style.setProperty('--foreground', theme.colors.text)
  root.style.setProperty('--card', theme.colors.card)
  root.style.setProperty('--card-foreground', theme.colors.text)
  root.style.setProperty('--popover', theme.colors.card)
  root.style.setProperty('--popover-foreground', theme.colors.text)
  root.style.setProperty('--primary', theme.colors.primary)
  root.style.setProperty('--primary-foreground', theme.colors.primaryText)
  root.style.setProperty('--secondary', theme.colors.backgroundSecondary)
  root.style.setProperty('--secondary-foreground', theme.colors.text)
  root.style.setProperty('--muted', theme.colors.backgroundSecondary)
  root.style.setProperty('--muted-foreground', theme.colors.textMuted)
  root.style.setProperty('--accent', theme.colors.accent)
  root.style.setProperty('--accent-foreground', theme.colors.primaryText)
  root.style.setProperty('--destructive', theme.colors.error)
  root.style.setProperty('--destructive-foreground', theme.colors.primaryText)
  root.style.setProperty('--border', theme.colors.border)
  root.style.setProperty('--input', theme.colors.border)
  root.style.setProperty('--ring', theme.colors.primary)
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
