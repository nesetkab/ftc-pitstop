"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PerformanceModule } from "../modules/performance-module"
import { OPRSmallModule } from "../modules/opr-module"
import { TeamStats, Ranking, Match } from "@/app/dashboard/[eventCode]/[teamNumber]/page"
import { ComparisonData } from "../team-comparison"

interface GeneralTabProps {
  eventCode: string
  teamNumber: number
  ranking: Ranking
  teamStats: TeamStats
  matches: Match[]
}

export function GeneralTab({ eventCode, teamNumber, ranking, teamStats, matches }: GeneralTabProps) {
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [oprHistory, setOprHistory] = useState<any[]>([])

  const fetchComparison = async () => {
    try {
      setError(null)
      const url = `/api/events/${eventCode}/team-comparison?team=${teamNumber}`
      const response = await fetch(url)
      const result = await response.json()

      if (response.ok) {
        setData(result)
      } else {
        setError("Unable to load team comparison data")
      }
    } catch (error) {
      console.error("Error fetching comparison:", error)
      setError("Failed to load comparison data")
    } finally {
      setLoading(false)
    }
  }

  const fetchOPRHistory = async () => {
    try {
      // TODO: Implement FTCScout API integration for historical OPR data
      // For now, just show current OPR
      console.log("OPR history fetch - to be implemented with FTCScout API")
    } catch (error) {
      console.error("Error fetching OPR history:", error)
    }
  }

  useEffect(() => {
    fetchComparison()
    fetchOPRHistory()
    const interval = setInterval(fetchComparison, 240000)
    return () => clearInterval(interval)
  }, [eventCode, teamNumber])

  const upcomingMatches = matches.filter(m => !m.played).slice(0, 5)

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Team Ranking & Performance */}
      <div className="col-span-4">
        <PerformanceModule teamRanking={ranking} teamStats={teamStats} />
      </div>

      {/* OPR Stats */}
      <div className="col-span-4">
        <OPRSmallModule
          opr={data?.targetTeam?.opr}
          dpr={data?.targetTeam?.dpr}
          ccwm={data?.targetTeam?.ccwm}
          matchesPlayed={data?.targetTeam?.played}
          loading={loading}
          error={error}
        />
      </div>

      {/* Upcoming Matches */}
      <div className="col-span-4">
        <Card>
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
                      <span style={{ color: 'var(--color-red1)' }}>Red: {match.red1}, {match.red2}</span>
                      {" vs "}
                      <span style={{ color: 'var(--color-blue1)' }}>Blue: {match.blue1}, {match.blue2}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* OPR Over Time Chart */}
      <div className="col-span-12">
        <Card>
          <CardHeader>
            <CardTitle>OPR Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <p className="text-muted-foreground">OPR timeline visualization - Coming Soon</p>
              <p className="text-xs text-muted-foreground ml-2">(Will integrate with FTCScout API)</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
