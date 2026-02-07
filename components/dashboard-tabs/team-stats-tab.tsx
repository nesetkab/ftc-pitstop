"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ComparisonData } from "../team-comparison"
import { TeamStats, Match, Ranking } from "@/app/dashboard/[eventCode]/[teamNumber]/page"
import { cachedFetch, BROWSER_CACHE_TTL } from "@/lib/browser-cache"

interface TeamStatsTabProps {
  eventCode: string
  teamNumber: number
  matches?: Match[]
  teamStats?: TeamStats | null
  ranking?: Ranking | null
  teamNames?: { [key: number]: string }
  onMatchClick?: (match: Match) => void
}

export function TeamStatsTab({ eventCode, teamNumber, matches = [], teamStats, ranking, teamNames = {}, onMatchClick }: TeamStatsTabProps) {
  const teamLabel = (num: number) => {
    const name = teamNames[num]
    return name ? `${num} ${name}` : `${num}`
  }
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      setError(null)
      const url = `/api/events/${eventCode}/team-comparison?team=${teamNumber}`
      const { data: result } = await cachedFetch<any>(url, BROWSER_CACHE_TTL.COMPARISON)

      if (result.allTeams || result.targetTeam) {
        setData(result)
      } else if (result.error) {
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

  // Filter matches for this team only (qualification)
  const teamMatches = matches
    .filter(m => m.tournamentLevel === 'QUALIFICATION' || m.tournamentLevel === 'qual')
    .filter(m => m.red1 === teamNumber || m.red2 === teamNumber || m.blue1 === teamNumber || m.blue2 === teamNumber)
    .sort((a, b) => a.matchNumber - b.matchNumber)

  const playedMatches = teamMatches.filter(m => m.played)

  // Calculate performance breakdown
  const autoScores: number[] = []
  const teleopScores: number[] = []
  const totalScores: number[] = []
  const margins: number[] = []

  playedMatches.forEach(m => {
    const isRed = m.red1 === teamNumber || m.red2 === teamNumber
    const teamScore = isRed ? m.redScore : m.blueScore
    const oppScore = isRed ? m.blueScore : m.redScore
    totalScores.push(teamScore)
    margins.push(teamScore - oppScore)
  })

  const avgScore = totalScores.length > 0 ? totalScores.reduce((a, b) => a + b, 0) / totalScores.length : 0
  const highScore = totalScores.length > 0 ? Math.max(...totalScores) : 0
  const lowScore = totalScores.length > 0 ? Math.min(...totalScores) : 0
  const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0

  const getMatchResult = (match: Match) => {
    const isRed = match.red1 === teamNumber || match.red2 === teamNumber
    const teamScore = isRed ? match.redScore : match.blueScore
    const oppScore = isRed ? match.blueScore : match.redScore
    if (teamScore > oppScore) return 'W'
    if (teamScore < oppScore) return 'L'
    return 'T'
  }

  const getResultColor = (result: string) => {
    if (result === 'W') return 'text-green-500'
    if (result === 'L') return 'text-red-500'
    return 'text-yellow-500'
  }

  const getResultBg = (result: string) => {
    if (result === 'W') return 'rgba(34, 197, 94, 0.1)'
    if (result === 'L') return 'rgba(239, 68, 68, 0.1)'
    return 'rgba(234, 179, 8, 0.1)'
  }

  const target = data?.targetTeam

  return (
    <div className="space-y-4">
      {/* Compact OPR + Performance Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">OPR Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500 mr-2" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : !target?.opr ? (
            <p className="text-sm text-muted-foreground text-center py-3">No OPR data available yet</p>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              <div className="p-2 rounded text-center" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                <div className="text-lg font-bold text-green-500">{target.opr.toFixed(1)}</div>
                <div className="text-[10px] text-muted-foreground">Total OPR</div>
              </div>
              <div className="p-2 rounded text-center" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                <div className="text-lg font-bold text-blue-500">{target.dpr?.toFixed(1) || 'N/A'}</div>
                <div className="text-[10px] text-muted-foreground">DPR</div>
              </div>
              <div className="p-2 rounded text-center" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                <div className="text-lg font-bold text-purple-500">{target.autoOpr?.toFixed(1) || 'N/A'}</div>
                <div className="text-[10px] text-muted-foreground">Auto</div>
              </div>
              <div className="p-2 rounded text-center" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                <div className="text-lg font-bold text-indigo-500">{target.teleopOpr?.toFixed(1) || 'N/A'}</div>
                <div className="text-[10px] text-muted-foreground">TeleOp</div>
              </div>
              <div className="p-2 rounded text-center" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                <div className="text-lg font-bold text-cyan-500">{target.endgameOpr?.toFixed(1) || 'N/A'}</div>
                <div className="text-[10px] text-muted-foreground">Endgame</div>
              </div>
              <div className="p-2 rounded text-center" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                <div className="text-lg font-bold">{target.played ?? 0}</div>
                <div className="text-[10px] text-muted-foreground">Matches</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Performance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {playedMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No matches played yet</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                <div className="text-xs text-muted-foreground">Avg Alliance Score</div>
                <div className="text-xl font-bold">{avgScore.toFixed(1)}</div>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                <div className="text-xs text-muted-foreground">High Score</div>
                <div className="text-xl font-bold text-green-500">{highScore}</div>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                <div className="text-xs text-muted-foreground">Low Score</div>
                <div className="text-xl font-bold text-red-400">{lowScore}</div>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                <div className="text-xs text-muted-foreground">Avg Margin</div>
                <div className={`text-xl font-bold ${avgMargin >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                  {avgMargin >= 0 ? '+' : ''}{avgMargin.toFixed(1)}
                </div>
              </div>
            </div>
          )}

          {/* OPR Breakdown Bar */}
          {data?.targetTeam && (data.targetTeam.autoOpr || data.targetTeam.teleopOpr || data.targetTeam.endgameOpr) && (
            <div className="mt-4">
              <div className="text-xs text-muted-foreground mb-2">OPR Breakdown</div>
              <div className="flex rounded-lg overflow-hidden h-6">
                {data.targetTeam.autoOpr != null && data.targetTeam.autoOpr > 0 && (
                  <div
                    className="flex items-center justify-center text-[10px] font-medium text-white"
                    style={{
                      backgroundColor: '#a855f7',
                      width: `${(data.targetTeam.autoOpr / (data.targetTeam.opr || 1)) * 100}%`,
                      minWidth: '30px'
                    }}
                  >
                    Auto {data.targetTeam.autoOpr.toFixed(1)}
                  </div>
                )}
                {data.targetTeam.teleopOpr != null && data.targetTeam.teleopOpr > 0 && (
                  <div
                    className="flex items-center justify-center text-[10px] font-medium text-white"
                    style={{
                      backgroundColor: '#6366f1',
                      width: `${(data.targetTeam.teleopOpr / (data.targetTeam.opr || 1)) * 100}%`,
                      minWidth: '30px'
                    }}
                  >
                    Teleop {data.targetTeam.teleopOpr.toFixed(1)}
                  </div>
                )}
                {data.targetTeam.endgameOpr != null && data.targetTeam.endgameOpr > 0 && (
                  <div
                    className="flex items-center justify-center text-[10px] font-medium text-white"
                    style={{
                      backgroundColor: '#06b6d4',
                      width: `${(data.targetTeam.endgameOpr / (data.targetTeam.opr || 1)) * 100}%`,
                      minWidth: '30px'
                    }}
                  >
                    End {data.targetTeam.endgameOpr.toFixed(1)}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Match History</CardTitle>
        </CardHeader>
        <CardContent>
          {teamMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No matches scheduled yet</p>
          ) : (
            <div className="space-y-1.5">
              {teamMatches.map((match) => {
                const isRed = match.red1 === teamNumber || match.red2 === teamNumber
                const teamScore = isRed ? match.redScore : match.blueScore
                const oppScore = isRed ? match.blueScore : match.redScore
                const partner = isRed
                  ? (match.red1 === teamNumber ? match.red2 : match.red1)
                  : (match.blue1 === teamNumber ? match.blue2 : match.blue1)
                const opponents = isRed
                  ? [match.blue1, match.blue2]
                  : [match.red1, match.red2]
                const result = match.played ? getMatchResult(match) : null

                return (
                  <div
                    key={match.matchNumber}
                    className="flex items-center gap-3 p-2 rounded border text-sm cursor-pointer hover:bg-accent/30 transition-colors"
                    style={{
                      borderColor: 'var(--color-border)',
                      backgroundColor: match.played ? getResultBg(result!) : 'var(--color-background-secondary)'
                    }}
                    onClick={() => onMatchClick?.(match)}
                  >
                    {/* Match number */}
                    <div className="w-8 text-center">
                      <span className="text-xs font-medium text-muted-foreground">Q{match.matchNumber}</span>
                    </div>

                    {/* Result badge */}
                    <div className="w-6">
                      {match.played ? (
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1 py-0 ${getResultColor(result!)}`}
                        >
                          {result}
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      )}
                    </div>

                    {/* Score */}
                    <div className="w-16 text-center">
                      {match.played ? (
                        <span className="font-semibold text-xs">
                          {teamScore} - {oppScore}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {match.startTime
                            ? new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'TBD'}
                        </span>
                      )}
                    </div>

                    {/* Alliance info */}
                    <div className="flex-1 text-xs">
                      <span className="text-muted-foreground">w/ </span>
                      <span className="font-medium">{teamLabel(partner)}</span>
                      <span className="text-muted-foreground"> vs </span>
                      <span>{opponents.map(o => teamLabel(o)).join(', ')}</span>
                    </div>

                    {/* Alliance color */}
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: isRed ? 'var(--color-red1)' : 'var(--color-blue1)' }}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
