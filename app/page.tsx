"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Monitor, Calculator, ClipboardPen, TestTube } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"
import Link from "next/link"
import pitstopLogoWhite from "../public/pitstop_white_logo.svg"
import pitstopLogoBlack from "../public/pitstop_black_logo.svg"

export default function HomePage() {

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-black">
      <div className="absolute top-4 right-4 flex gap-2">
        <Link href="/test" >
          <Button variant="outline" className='min-h-8' size="icon">
            <TestTube className="h-6 w-6 " />
          </Button>
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex-grow container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-3 rounded-xl">
              <Image className="hidden dark:flex" src={pitstopLogoWhite} width={500} height={500} alt="logo" />
              <Image className="dark:hidden" src={pitstopLogoBlack} width={500} height={500} alt="logo" />
            </div>
          </div>
          <p className="text-xl font-bold  mb-2">
            The All-in-One website for FIRST Tech Challenge competitions.
          </p>
          <p className="text-sm ">
            Real-time rankings, match schedules, and team performance analytics, all personalized for your needs.
          </p>
        </div>


        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <Link href="/dashboard">
            <Card className="hover:bg-border transition-colors">
              <CardContent className="p-6 text-center">
                <div className="bg-green-600 rounded-sm w-fit justify-self-center mb-3">
                  <h3 className="font-semibold mx-2">
                    Public Beta!
                  </h3>
                </div>
                <Monitor className="h-8 w-8 mx-auto mb-3 text-blue-600" />
                <p className="text-sm text-muted-foreground">Real-time tournament rankings and standings</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="" className="hover:cursor-not-allowed">
            <Card className="hover:bg-border transition-colors hover:text-muted-foreground">
              <CardTitle className="py-2 text-center items-center">

                <div className="font-black flex flex-row gap-2 items-center justify-self-center max-w-fit">
                  <ClipboardPen className="h-8 w-8 text-green-600" />
                  Scouting Client
                </div>
              </CardTitle>
              <CardHeader className="text-center items-center">
                <div className="bg-red-600 rounded-sm w-fit justify-self-center ">
                  <h3 className="font-semibold mx-2">
                    Unreleased :(
                  </h3>
                </div>
              </CardHeader>
              <CardContent className="text-center">

                <p className="text-sm text-muted-foreground">Upcoming matches with smart notifications</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="" className="hover:cursor-not-allowed">
            <Card className="hover:bg-border transition-colors">
              <CardContent className="p-6 text-center">
                <div className="bg-red-600 rounded-sm w-fit justify-self-center mb-3">
                  <h3 className="font-semibold mx-2">
                    Unreleased :(
                  </h3>
                </div>
                <Calculator className="h-8 w-8 mx-auto mb-3 text-purple-600" />
                <h3 className="font-semibold mb-2">Advancement Calculator</h3>
                <p className="text-sm text-muted-foreground">Performance stats, OPR, and match history</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div >
  )
}
