"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Monitor, Smartphone, TestTube } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import Footer from "@/components/footer"

import pitstopLogoWhite from "../public/pitstop_white_logo.svg"
import pitstopLogoBlack from "../public/pitstop_black_logo.svg"

export default function HomePage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="container mx-auto px-4 py-4 flex justify-end items-center">
        {/* Removed logo from here. Adjusted justify-content. */}
        <div className="flex items-center gap-2">
          <Link href="/test">
            <Button variant="outline" size="icon">
              <TestTube className="h-5 w-5" />
            </Button>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-16">
          {/* Logo moved here and made larger */}
          <div className="flex items-center justify-center mb-8">
            {mounted && (
              <Image
                src={
                  theme === "dark" || theme === "system"
                    ? pitstopLogoWhite
                    : pitstopLogoBlack
                }
                width={500} // Increased width
                height={500} // Increased height
                alt="Pitstop Logo"
              />
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            The All-in-One Platform for FTC
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Real-time rankings, match schedules, and performance analytics to
            give your team the winning edge.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Link href="/dashboard">
            <Card className="h-full hover:border-primary transition-colors duration-300">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-3">
                  <Monitor className="h-8 w-8 text-primary" />
                  <h3 className="text-xl font-semibold">Pit Dashboard</h3>
                </div>
                <p className="text-muted-foreground">
                  A real-time dashboard for your pit display, showing everything
                  you need during a competition.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Card className="h-full border-dashed opacity-70 cursor-not-allowed">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <Smartphone className="h-8 w-8" />
                  <h3 className="text-xl font-semibold">Mobile App</h3>
                </div>
                <Badge variant="secondary">Coming Soon</Badge>
              </div>
              <p className="text-muted-foreground">
                Access all of Pitstop&apos;s features from the convenience of
                your phone. Perfect for scouts and strategists.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}
