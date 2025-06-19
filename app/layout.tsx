import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "next-themes"
import { Analytics } from "@vercel/analytics/next"
import Footer from "@/components/footer"
import { BetaBanner } from "@/components/beta-banner"
const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Pitstop - FTC Pit Display",
  description: "The One-Stop Shop for all of your FTC pit essentials :3"
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="__className_e8ce0c" suppressHydrationWarning>
        <BetaBanner />
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
        < Footer />

      </body>
      < Analytics />
    </html>
  )
}
