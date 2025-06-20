"use client"

import { AlertTriangle, X } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
export function BetaBanner() {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 relative">
      <div className="flex items-center justify-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="text-center">
          Pitstop is currently a public beta - expect bugs! Find an issue? Join our <Link href="https://discord.gg/9Rdbdr2NAt" target="_blank" className="underline">Discord!</Link>        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsVisible(false)}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-white/20 text-white"
        >
          <X className="h-3 w-3" />
          <span className="sr-only">Dismiss banner</span>
        </Button>
      </div>
    </div>
  )
}
