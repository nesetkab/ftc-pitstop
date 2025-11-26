'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Check, Palette } from 'lucide-react'
import { useCustomTheme } from './theme-provider-custom'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

export function ThemeSettingsDialog() {
  const { currentTheme, setTheme, availableThemes } = useCustomTheme()
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Palette className="h-4 w-4" />
          Theme
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose Your Theme</DialogTitle>
          <DialogDescription>
            Select a preset theme or customize your own color scheme
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="grid gap-4">
            {availableThemes.map((theme) => (
              <Card
                key={theme.id}
                className={`cursor-pointer transition-all hover:shadow-lg ${currentTheme.id === theme.id
                    ? 'ring-2 ring-primary'
                    : 'hover:ring-1 hover:ring-border-hover'
                  }`}
                onClick={() => {
                  setTheme(theme.id)
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{theme.name}</h3>
                      <p className="text-sm text-text-muted">
                        {theme.id === 'default' && 'Classic dark theme with blue accents'}
                        {theme.id === 'light' && 'Clean light mode for bright environments'}
                        {theme.id === 'ocean' && 'Cool blue tones inspired by the deep ocean'}
                        {theme.id === 'forest' && 'Natural green palette for easy viewing'}
                        {theme.id === 'sunset' && 'Warm orange hues perfect for evening'}
                        {theme.id === 'midnight' && 'Deep purple for late-night coding'}
                        {theme.id === 'cherry' && 'Bold red theme for team spirit'}
                        {theme.id === 'high-contrast' && 'Maximum readability and accessibility'}
                      </p>
                    </div>
                    {currentTheme.id === theme.id && (
                      <div className="flex items-center gap-1 text-primary">
                        <Check className="h-5 w-5" />
                        <span className="text-sm font-medium">Active</span>
                      </div>
                    )}
                  </div>

                  {/* Color Preview */}
                  <div className="grid grid-cols-8 gap-2">
                    <div
                      className="h-10 rounded border"
                      style={{ backgroundColor: theme.colors.background }}
                      title="Background"
                    />
                    <div
                      className="h-10 rounded border"
                      style={{ backgroundColor: theme.colors.primary }}
                      title="Primary"
                    />
                    <div
                      className="h-10 rounded border"
                      style={{ backgroundColor: theme.colors.accent }}
                      title="Accent"
                    />
                    <div
                      className="h-10 rounded border"
                      style={{ backgroundColor: theme.colors.success }}
                      title="Success"
                    />
                    <div
                      className="h-10 rounded border"
                      style={{ backgroundColor: theme.colors.warning }}
                      title="Warning"
                    />
                    <div
                      className="h-10 rounded border"
                      style={{ backgroundColor: theme.colors.error }}
                      title="Error"
                    />
                    <div
                      className="h-10 rounded border"
                      style={{ backgroundColor: theme.colors.red1 }}
                      title="Red Alliance"
                    />
                    <div
                      className="h-10 rounded border"
                      style={{ backgroundColor: theme.colors.blue1 }}
                      title="Blue Alliance"
                    />
                  </div>

                  {/* Preview Cards */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div
                      className="p-3 rounded text-sm"
                      style={{
                        backgroundColor: theme.colors.card,
                        color: theme.colors.text,
                        borderColor: theme.colors.border,
                        borderWidth: '1px',
                      }}
                    >
                      <div className="font-medium mb-1">Sample Card</div>
                      <div style={{ color: theme.colors.textSecondary }}>
                        Secondary text
                      </div>
                    </div>
                    <div
                      className="p-3 rounded text-sm"
                      style={{
                        backgroundColor: theme.colors.primary,
                        color: theme.colors.primaryText,
                      }}
                    >
                      <div className="font-medium">Primary Button</div>
                      <div className="opacity-90">Click me!</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
