"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Search, Calendar, Trophy, Users, AlertCircle, TestTube, Clock, MapPin } from "lucide-react"
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
            All of your FTC-pit essentials - on just one display.
          </p>
          <p className="text-sm ">
            Real-time rankings, match schedules, and team performance analytics, all personalized for your needs.
          </p>
        </div>


        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <Link href="/dashboard">
            <Card className="hover:bg-border transition-colors">
              <CardContent className="p-6 text-center">
                <Trophy className="h-8 w-8 mx-auto mb-3 text-blue-600" />
                <h3 className="font-semibold mb-2">Live Rankings</h3>
                <p className="text-sm text-muted-foreground">Real-time tournament rankings and standings</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="" className="hover:cursor-not-allowed">
            <Card className="hover:bg-border transition-colors hover:text-muted-foreground">
              <CardContent className="p-6 text-center">
                <Calendar className="h-8 w-8 mx-auto mb-3 text-green-600" />
                <h3 className="font-semibold mb-2">Match Schedule</h3>
                <p className="text-sm text-muted-foreground">Upcoming matches with smart notifications</p>
              </CardContent>
            </Card>
          </Link>
          <Card className="hover:bg-border transition-colors">
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 mx-auto mb-3 text-purple-600" />
              <h3 className="font-semibold mb-2">Team Analytics</h3>
              <p className="text-sm text-muted-foreground">Performance stats, OPR, and match history</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
