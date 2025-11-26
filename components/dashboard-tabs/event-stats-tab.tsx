"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState, useEffect } from "react"
import { ComparisonData } from "../team-comparison"

interface EventStatsTabProps {
  eventCode: string
}

export function EventStatsTab({ eventCode }: EventStatsTabProps) {
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const url = `/api/events/${eventCode}/team-comparison`
      const response = await fetch(url)
      const result = await response.json()

      if (response.ok) {
        setData(result)
      }
    } catch (error) {
      console.error("Error fetching event data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 240000)
    return () => clearInterval(interval)
  }, [eventCode])

  const sortedTeams = data?.allTeams?.sort((a, b) => (b.opr || 0) - (a.opr || 0)) || []

  return (
    <div className="space-y-4">
      {/* Top Teams by OPR */}
      <Card>
        <CardHeader>
          <CardTitle>Top Teams by OPR</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : sortedTeams.length === 0 ? (
            <p className="text-muted-foreground">No team data available yet</p>
          ) : (
            <div className="space-y-2">
              {sortedTeams.slice(0, 20).filter(team => team && team.teamNumber).map((team, index) => (
                <div
                  key={`team-${team.teamNumber}-${index}`}
                  className="flex justify-between items-center p-2 rounded border"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-muted-foreground w-6">#{index + 1}</span>
                    <span className="font-semibold">{team.teamNumber}</span>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">OPR: </span>
                      <span className="font-semibold">{team.opr?.toFixed(1) || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">DPR: </span>
                      <span className="font-semibold">{team.dpr?.toFixed(1) || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Statistics Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Highest OPR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {sortedTeams[0]?.opr?.toFixed(1) || 'N/A'}
            </p>
            <p className="text-sm text-muted-foreground">
              Team {sortedTeams[0]?.teamNumber || '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average OPR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {sortedTeams.length > 0
                ? (sortedTeams.reduce((sum, t) => sum + (t.opr || 0), 0) / sortedTeams.length).toFixed(1)
                : 'N/A'}
            </p>
            <p className="text-sm text-muted-foreground">
              Across {sortedTeams.length} teams
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{sortedTeams.length}</p>
            <p className="text-sm text-muted-foreground">At this event</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
