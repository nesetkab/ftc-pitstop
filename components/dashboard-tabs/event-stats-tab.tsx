"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { ComparisonData } from "../team-comparison"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

interface EventStatsTabProps {
  eventCode: string
}

type SortField = 'opr' | 'dpr' | 'autoOpr' | 'teleopOpr' | 'endgameOpr'
type SortDirection = 'asc' | 'desc'

export function EventStatsTab({ eventCode }: EventStatsTabProps) {
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('opr')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

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

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const sortedTeams = data?.allTeams?.sort((a, b) => {
    const aValue = a[sortField] || 0
    const bValue = b[sortField] || 0
    return sortDirection === 'desc' ? bValue - aValue : aValue - bValue
  }) || []

  const SortButton = ({ field, label }: { field: SortField, label: string }) => (
    <Button
      variant={sortField === field ? "default" : "outline"}
      size="sm"
      onClick={() => handleSort(field)}
      className="gap-1"
    >
      {label}
      {sortField === field && (
        sortDirection === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
      )}
    </Button>
  )

  return (
    <div className="space-y-4">
      {/* Top Teams by OPR */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Team Rankings</CardTitle>
            <div className="flex gap-2">
              <SortButton field="opr" label="Total OPR" />
              <SortButton field="autoOpr" label="Auto" />
              <SortButton field="teleopOpr" label="TeleOp" />
              <SortButton field="endgameOpr" label="Endgame" />
              <SortButton field="dpr" label="DPR" />
            </div>
          </div>
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
                  <div className="flex gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">OPR: </span>
                      <span className="font-semibold">{team.opr?.toFixed(1) || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Auto: </span>
                      <span className="font-semibold text-purple-600">{team.autoOpr?.toFixed(1) || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">TeleOp: </span>
                      <span className="font-semibold text-indigo-600">{team.teleopOpr?.toFixed(1) || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Endgame: </span>
                      <span className="font-semibold text-cyan-600">{team.endgameOpr?.toFixed(1) || 'N/A'}</span>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Highest Total OPR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {sortedTeams[0]?.opr?.toFixed(1) || 'N/A'}
            </p>
            <p className="text-sm text-muted-foreground">
              Team {sortedTeams[0]?.teamNumber || '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Highest Auto OPR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              {[...sortedTeams].sort((a, b) => (b.autoOpr || 0) - (a.autoOpr || 0))[0]?.autoOpr?.toFixed(1) || 'N/A'}
            </p>
            <p className="text-sm text-muted-foreground">
              Team {[...sortedTeams].sort((a, b) => (b.autoOpr || 0) - (a.autoOpr || 0))[0]?.teamNumber || '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Highest TeleOp OPR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-indigo-600">
              {[...sortedTeams].sort((a, b) => (b.teleopOpr || 0) - (a.teleopOpr || 0))[0]?.teleopOpr?.toFixed(1) || 'N/A'}
            </p>
            <p className="text-sm text-muted-foreground">
              Team {[...sortedTeams].sort((a, b) => (b.teleopOpr || 0) - (a.teleopOpr || 0))[0]?.teamNumber || '-'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Highest Endgame OPR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-cyan-600">
              {[...sortedTeams].sort((a, b) => (b.endgameOpr || 0) - (a.endgameOpr || 0))[0]?.endgameOpr?.toFixed(1) || 'N/A'}
            </p>
            <p className="text-sm text-muted-foreground">
              Team {[...sortedTeams].sort((a, b) => (b.endgameOpr || 0) - (a.endgameOpr || 0))[0]?.teamNumber || '-'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
