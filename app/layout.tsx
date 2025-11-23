import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { ThemeProvider } from "next-themes"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import { CustomThemeProvider } from "@/components/theme-provider-custom"

export const metadata: Metadata = {
  title: "Pitstop - FTC Pit Display",
  description: "The All-in-One website for FIRST Tech Challenge competitions.",
  keywords: ["FTC", "FIRST Tech Challenge", "robotics", "scouting", "pit display", "FTC Pitstop"],
  openGraph: {
    title: "Pitstop - FTC Pit Display",
    description: "The All-in-One website for FIRST Tech Challenge competitions.",
    url: "https://ftcpitstop.com/",
    siteName: "FTC Pitstop",
    images: [
      {
        url: "/pitstop_banner.png",
        width: 1200,
        height: 630,
        alt: "FTC Pitstop Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pitstop - FTC Pit Display",
    description: "The All-in-One website for FIRST Tech Challenge competitions.",
    images: ["/pitstop_banner.png"],
  },
  icons: {
    icon: "/favicon.ico"
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="__className_e8ce0c" suppressHydrationWarning>
        <CustomThemeProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            {children}
          </ThemeProvider>
        </CustomThemeProvider>
        <Toaster position="top-center" />
      </body>
      <Analytics />
    </html>
  )
}
