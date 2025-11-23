"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RankingsModule } from "../modules/rankings-module"
import { Ranking, Match } from "@/app/dashboard/[eventCode]/[teamNumber]/page"

interface WatchTabProps {
  eventCode: string
  teamNumber: number
  rankings: Ranking[]
  matches: Match[]
}

export function WatchTab({ eventCode, teamNumber, rankings, matches }: WatchTabProps) {
  const upcomingMatches = matches.filter(m => !m.played).slice(0, 10)

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Stream Embed */}
      <div className="col-span-8">
        <Card>
          <CardHeader>
            <CardTitle>Live Stream</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
              <p className="text-white">Stream embed will go here</p>
              <p className="text-xs text-gray-400 ml-2">(Twitch/YouTube integration)</p>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Matches */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Upcoming Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming matches</p>
              ) : (
                upcomingMatches.map((match) => (
                  <div
                    key={match.matchNumber}
                    className="p-3 rounded-lg border"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold">{match.description}</span>
                      <span className="text-xs text-muted-foreground">
                        {match.startTime ? new Date(match.startTime).toLocaleTimeString() : "TBD"}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span style={{ color: 'var(--color-red1)' }}>
                        Red: {match.red1}, {match.red2}
                      </span>
                      {" vs "}
                      <span style={{ color: 'var(--color-blue1)' }}>
                        Blue: {match.blue1}, {match.blue2}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <div className="col-span-4">
        <RankingsModule rankings={rankings} teamNumber={teamNumber} />
      </div>
    </div>
  )
}
