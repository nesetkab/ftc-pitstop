"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RankingsModule } from "../modules/rankings-module"
import { Ranking, Match } from "@/app/dashboard/[eventCode]/[teamNumber]/page"
import { Badge } from "@/components/ui/badge"

interface RankingsScheduleTabProps {
  eventCode: string
  teamNumber: number
  rankings: Ranking[]
  matches: Match[]
}

export function RankingsScheduleTab({ eventCode, teamNumber, rankings, matches }: RankingsScheduleTabProps) {
  const upcomingMatches = matches.filter(m => !m.played)
  const completedMatches = matches.filter(m => m.played)

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Rankings */}
      <div className="col-span-5">
        <RankingsModule rankings={rankings} teamNumber={teamNumber} />
      </div>

      {/* Schedule */}
      <div className="col-span-7">
        <Card>
          <CardHeader>
            <CardTitle>Match Schedule</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[800px] overflow-y-auto">
            {/* Upcoming Matches */}
            {upcomingMatches.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Upcoming Matches</h3>
                <div className="space-y-2">
                  {upcomingMatches.map((match) => (
                    <div
                      key={match.matchNumber}
                      className="p-3 rounded-lg border"
                      style={{
                        borderColor: 'var(--color-border)',
                        backgroundColor:
                          match.red1 === teamNumber ||
                          match.red2 === teamNumber ||
                          match.blue1 === teamNumber ||
                          match.blue2 === teamNumber
                            ? 'var(--color-card-hover)'
                            : 'var(--color-card)',
                      }}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{match.description}</span>
                          {match.tournamentLevel !== 'Qualification' && (
                            <Badge variant="secondary">{match.tournamentLevel}</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {match.startTime ? new Date(match.startTime).toLocaleTimeString() : "TBD"}
                        </span>
                      </div>
                      <div className="text-sm">
                        <div style={{ color: 'var(--color-red1)' }}>
                          Red: {match.red1}, {match.red2}
                        </div>
                        <div style={{ color: 'var(--color-blue1)' }}>
                          Blue: {match.blue1}, {match.blue2}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Matches */}
            {completedMatches.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Completed Matches</h3>
                <div className="space-y-2">
                  {completedMatches.reverse().map((match) => (
                    <div
                      key={match.matchNumber}
                      className="p-3 rounded-lg border opacity-75"
                      style={{
                        borderColor: 'var(--color-border)',
                        backgroundColor: 'var(--color-card)',
                      }}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{match.description}</span>
                          {match.tournamentLevel !== 'Qualification' && (
                            <Badge variant="secondary">{match.tournamentLevel}</Badge>
                          )}
                        </div>
                        <div className="text-sm font-bold">
                          <span style={{ color: 'var(--color-red1)' }}>{match.redScore}</span>
                          {" - "}
                          <span style={{ color: 'var(--color-blue1)' }}>{match.blueScore}</span>
                        </div>
                      </div>
                      <div className="text-sm opacity-75">
                        <div style={{ color: 'var(--color-red1)' }}>
                          Red: {match.red1}, {match.red2}
                        </div>
                        <div style={{ color: 'var(--color-blue1)' }}>
                          Blue: {match.blue1}, {match.blue2}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
