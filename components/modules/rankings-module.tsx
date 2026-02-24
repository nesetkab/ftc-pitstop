"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Ranking } from "@/app/dashboard/[eventCode]/[teamNumber]/page"

export function RankingsModule({ rankings, teamNumber, eventCode, teamNames = {} }: { rankings: Ranking[], teamNumber: number, eventCode?: string, teamNames?: { [key: number]: string } }) {
  const router = useRouter()
  return (
    <Card className="flex flex-col h-fit">
      <CardHeader>
        <CardTitle className="flex items-center ">
          Rankings
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col overflow-y-auto max-h-[500px]">
        <div className="space-y-2 flex flex-col">
          {rankings.slice(0, rankings.length).map((ranking, index) => (
            <div
              key={ranking.teamNumber}
              className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-accent/50 transition-colors ${ranking.teamNumber === teamNumber ? "bg-purple-100 dark:bg-purple-900" : ""
                }`}
              onClick={() => eventCode && router.push(`/dashboard/${eventCode}/${ranking.teamNumber}`)}
            >
              <div className="flex items-center gap-2">
                <Badge variant={index < 3 ? "default" : "secondary"} >#{ranking.rank}</Badge>
                <span>{ranking.teamNumber} {ranking.teamName || teamNames[ranking.teamNumber] || ''}</span>

              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {(ranking.rp > 0 || ranking.tbp > 0) && (
                  <span className="text-[10px]">RP: {ranking.rp} | TBP: {ranking.tbp}</span>
                )}
                <span>{ranking.wins}-{ranking.losses}-{ranking.ties}</span>
              </div>
            </div>
          ))}
          {rankings.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              Rankings will appear here during the event.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
