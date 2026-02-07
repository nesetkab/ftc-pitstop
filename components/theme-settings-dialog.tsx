'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
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

interface ThemeSettingsDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ThemeSettingsDialog({ open: externalOpen, onOpenChange }: ThemeSettingsDialogProps = {}) {
  const { currentTheme, setTheme, availableThemes } = useCustomTheme()
  const [internalOpen, setInternalOpen] = useState(false)

  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = onOpenChange || setInternalOpen
  const isControlled = externalOpen !== undefined

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Palette className="h-4 w-4" />
            Theme
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose Your Theme</DialogTitle>
          <DialogDescription>
            Select a preset theme or customize your own color scheme
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="grid gap-2">
            {availableThemes.map((theme) => (
              <div
                key={theme.id}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${currentTheme.id === theme.id
                  ? 'ring-2 ring-primary bg-accent/50'
                  : 'hover:bg-accent/30'
                  }`}
                onClick={() => {
                  setTheme(theme.id)
                }}
              >
                <div
                  className="h-8 w-8 rounded-full border flex-shrink-0"
                  style={{ backgroundColor: theme.colors.primary, borderColor: theme.colors.border }}
                />
                <span className="font-medium flex-1">{theme.name}</span>
                {currentTheme.id === theme.id && (
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </div>
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
