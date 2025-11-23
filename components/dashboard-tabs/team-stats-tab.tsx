"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { OPRModule } from "../modules/opr-module"
import { ComparisonData } from "../team-comparison"

interface TeamStatsTabProps {
  eventCode: string
  teamNumber: number
}

export function TeamStatsTab({ eventCode, teamNumber }: TeamStatsTabProps) {
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setError(null)
      const url = `/api/events/${eventCode}/team-comparison?team=${teamNumber}`
      const response = await fetch(url)
      const result = await response.json()

      if (response.ok) {
        setData(result)
      } else {
        setError("Unable to load team data")
      }
    } catch (error) {
      console.error("Error fetching team data:", error)
      setError("Failed to load team data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 240000)
    return () => clearInterval(interval)
  }, [eventCode, teamNumber])

  return (
    <div className="space-y-4">
      {/* Detailed OPR Stats */}
      <OPRModule
        opr={data?.targetTeam?.opr}
        dpr={data?.targetTeam?.dpr}
        ccwm={data?.targetTeam?.ccwm}
        matchesPlayed={data?.targetTeam?.played}
        loading={loading}
        error={error}
      />

      {/* Match History */}
      <Card>
        <CardHeader>
          <CardTitle>Match History</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Detailed match-by-match breakdown - Coming Soon</p>
        </CardContent>
      </Card>

      {/* Performance Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Auto vs Teleop vs Endgame analysis - Coming Soon</p>
        </CardContent>
      </Card>
    </div>
  )
}
