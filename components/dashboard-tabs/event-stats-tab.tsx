"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { ComparisonData } from "../team-comparison"
import { ArrowUp, ArrowDown } from "lucide-react"
import { cachedFetch, BROWSER_CACHE_TTL } from "@/lib/browser-cache"

interface EventStatsTabProps {
  eventCode: string
  teamNames?: { [key: number]: string }
}

type SortField = 'rank' | 'opr' | 'dpr' | 'autoOpr' | 'teleopOpr' | 'endgameOpr' | 'winRate' | 'avgScore'
type SortDirection = 'asc' | 'desc'

export function EventStatsTab({ eventCode, teamNames = {} }: EventStatsTabProps) {
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortField, setSortField] = useState<SortField>('opr')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const fetchData = async () => {
    try {
      const url = `/api/events/${eventCode}/team-comparison`
      const { data: result } = await cachedFetch<any>(url, BROWSER_CACHE_TTL.COMPARISON)

      if (result.allTeams) {
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
      setSortDirection(field === 'rank' ? 'asc' : 'desc')
    }
  }

  const sortedTeams = [...(data?.allTeams || [])].sort((a, b) => {
    const aValue = (a as any)[sortField] || 0
    const bValue = (b as any)[sortField] || 0
    return sortDirection === 'desc' ? bValue - aValue : aValue - bValue
  })

  const SortHeader = ({ field, label, className = '' }: { field: SortField, label: string, className?: string }) => (
    <th
      className={`py-2 px-2 font-semibold text-xs cursor-pointer select-none hover:text-purple-400 transition-colors ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-0.5 justify-end">
        <span>{label}</span>
        {sortField === field && (
          sortDirection === 'desc'
            ? <ArrowDown className="h-3 w-3 text-purple-500" />
            : <ArrowUp className="h-3 w-3 text-purple-500" />
        )}
      </div>
    </th>
  )

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base">All Teams - OPR Breakdown</CardTitle>
            <span className="text-xs text-muted-foreground">{sortedTeams.length} teams</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : sortedTeams.length === 0 ? (
            <p className="text-muted-foreground p-6 text-center">No team data available yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <th className="py-2 px-2 text-left font-semibold text-xs w-8">#</th>
                    <th className="py-2 px-2 text-left font-semibold text-xs">Team</th>
                    <SortHeader field="opr" label="OPR" />
                    <SortHeader field="autoOpr" label="Auto" />
                    <SortHeader field="teleopOpr" label="TeleOp" />
                    <SortHeader field="endgameOpr" label="Endgame" />
                    <SortHeader field="dpr" label="DPR" />
                    <SortHeader field="winRate" label="Win%" />
                    <SortHeader field="avgScore" label="Avg" />
                    <th className="py-2 px-2 text-right font-semibold text-xs">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTeams.filter(t => t && t.teamNumber).map((team, index) => (
                    <tr
                      key={team.teamNumber}
                      className="border-b hover:bg-accent/30 transition-colors"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <td className="py-1.5 px-2 text-xs text-muted-foreground">{index + 1}</td>
                      <td className="py-1.5 px-2 font-semibold text-xs">{team.teamNumber} <span className="font-normal text-muted-foreground">{teamNames[team.teamNumber] || ''}</span></td>
                      <td className="py-1.5 px-2 text-right font-mono text-xs font-semibold">{team.opr?.toFixed(1) ?? '-'}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-xs text-purple-500">{team.autoOpr?.toFixed(1) ?? '-'}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-xs text-indigo-500">{team.teleopOpr?.toFixed(1) ?? '-'}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-xs text-cyan-500">{team.endgameOpr?.toFixed(1) ?? '-'}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-xs">{team.dpr?.toFixed(1) ?? '-'}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-xs">{team.winRate?.toFixed(0) ?? '-'}%</td>
                      <td className="py-1.5 px-2 text-right font-mono text-xs">{team.avgScore?.toFixed(0) ?? '-'}</td>
                      <td className="py-1.5 px-2 text-right text-xs">
                        <span className="text-green-500">{team.wins}</span>
                        -<span className="text-red-500">{team.losses}</span>
                        -<span className="text-muted-foreground">{team.ties}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Event Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Highest OPR</div>
            <div className="text-xl font-bold">{sortedTeams[0]?.opr?.toFixed(1) || '-'}</div>
            <div className="text-[10px] text-muted-foreground">Team {sortedTeams[0]?.teamNumber || '-'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Avg OPR</div>
            <div className="text-xl font-bold">
              {sortedTeams.length > 0
                ? (sortedTeams.reduce((s, t) => s + (t.opr || 0), 0) / sortedTeams.length).toFixed(1)
                : '-'}
            </div>
            <div className="text-[10px] text-muted-foreground">Across {sortedTeams.length} teams</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Highest Auto</div>
            <div className="text-xl font-bold text-purple-500">
              {[...sortedTeams].sort((a, b) => (b.autoOpr || 0) - (a.autoOpr || 0))[0]?.autoOpr?.toFixed(1) || '-'}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Team {[...sortedTeams].sort((a, b) => (b.autoOpr || 0) - (a.autoOpr || 0))[0]?.teamNumber || '-'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground">Total Teams</div>
            <div className="text-xl font-bold">{sortedTeams.length}</div>
            <div className="text-[10px] text-muted-foreground">At this event</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
