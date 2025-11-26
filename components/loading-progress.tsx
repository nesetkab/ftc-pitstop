"use client"

import { useEffect, useState } from "react"
import { Progress } from "@/components/ui/progress"
import { Loader2 } from "lucide-react"

interface LoadingProgressProps {
  steps: string[]
  currentStep: number
}

export function LoadingProgress({ steps, currentStep }: LoadingProgressProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    // Calculate progress percentage
    const percentage = Math.min(((currentStep + 1) / steps.length) * 100, 100)
    setProgress(percentage)
  }, [currentStep, steps.length])

  const currentMessage = steps[currentStep] || "Loading..."

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-md text-center px-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-6" />
        <h2 className="text-2xl font-semibold mb-2">{currentMessage}</h2>
        <Progress value={progress} className="h-2 mb-4" />
        <p className="text-sm text-muted-foreground">
          Step {currentStep + 1} of {steps.length}
        </p>
      </div>
    </div>
  )
}
