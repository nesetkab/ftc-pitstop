"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Monitor, Calculator, ClipboardPen, TestTube } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import Image from "next/image"
import Link from "next/link"
import pitstopLogoWhite from "../public/pitstop_white_logo.svg"
import pitstopLogoBlack from "../public/pitstop_black_logo.svg"

export default function HomePage() {

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      <div className="absolute top-4 right-4 flex gap-2">
        <Link href="/test" >
          <Button variant="outline" className='min-h-8' size="icon">
            <TestTube className="h-6 w-6 " />
          </Button>
        </Link>
      </div>

      <div className="flex-grow container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 rounded-xl">
              <Image className="flex" src={pitstopLogoWhite} width={500} height={500} alt="logo" />
            </div>
          </div>
          <p className="text-xl font-bold  mb-2">
            The All-in-One website for FIRST Tech Challenge competitions.
          </p>
        </div>


        <div className="grid md:grid-cols-2 justify-self-center gap-12 mt-48 ">
          <Link href="/dashboard">
            <Card className="hover:border-purple-400 border-white bg-black transition-colors">
              <CardContent className="p-4">
                <div className="rounded-sm w-fit mb-3">
                  <h3 className="font-semibold ">
                    Pitstop - Pit Dashboard
                  </h3>
                </div>
                <p className="text-sm ">
                  Real-time rankings, match schedules, and team performance analytics, all personalized for your needs.
                </p>
              </CardContent>
            </Card>
          </Link>
          <Link href="" className="">
            <Card className="hover:border-purple-400 border-white bg-black transition-colors">
              <CardContent className="p-4">
                <div className="rounded-sm w-fit mb-3">
                  <h3 className="font-semibold ">
                    Pitstop - For Mobile
                  </h3>
                </div>
                <p className="text-sm ">
                  Real-time rankings, match schedules, and team performance analytics, all personalized for your needs.
                </p>
              </CardContent>
            </Card>          </Link>
        </div>
      </div>
    </div >
  )
}
