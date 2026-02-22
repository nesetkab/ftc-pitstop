"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:!bg-emerald-600 group-[.toaster]:!text-white group-[.toaster]:!border-emerald-700 [&_[data-description]]:!text-emerald-100",
          error:
            "group-[.toaster]:!bg-red-600 group-[.toaster]:!text-white group-[.toaster]:!border-red-700 [&_[data-description]]:!text-red-100",
          info:
            "group-[.toaster]:!bg-blue-600 group-[.toaster]:!text-white group-[.toaster]:!border-blue-700 [&_[data-description]]:!text-blue-100",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
