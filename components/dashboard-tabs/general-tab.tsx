"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PerformanceModule } from "../modules/performance-module"
import { DetailedOPRModule } from "../modules/detailed-opr-module"
import { TeamStats, Ranking, Match } from "@/app/dashboard/[eventCode]/[teamNumber]/page"
import { ComparisonData } from "../team-comparison"
import { Trophy } from "lucide-react"
import { cachedFetch, BROWSER_CACHE_TTL } from "@/lib/browser-cache"

interface GeneralTabProps {
  eventCode: string
  teamNumber: number
  ranking: Ranking | null
  teamStats: TeamStats | null
  matches: Match[]
  rankings: Ranking[]
  teamNames?: { [key: number]: string }
  onMatchClick?: (match: Match) => void
}

export function GeneralTab({ eventCode, teamNumber, ranking, teamStats, matches, rankings, teamNames = {}, onMatchClick }: GeneralTabProps) {
  const teamLabel = (num: number) => {
    const name = teamNames[num]
    return name ? `${num} ${name}` : `${num}`
  }
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [allTeamsOPR, setAllTeamsOPR] = useState<any[]>([])
  const [oprRank, setOprRank] = useState<number | undefined>(undefined)
  const [totalTeams, setTotalTeams] = useState<number | undefined>(undefined)

  const fetchComparison = async () => {
    try {
      setError(null)
      const url = `/api/events/${eventCode}/team-comparison?team=${teamNumber}`
      const { data: result } = await cachedFetch<any>(url, BROWSER_CACHE_TTL.COMPARISON)

      if (result.allTeams || result.targetTeam) {
        setData(result)
      } else if (result.error) {
        setError("Unable to load team comparison data")
      }
    } catch (error) {
      console.error("Error fetching comparison:", error)
      setError("Failed to load comparison data")
    } finally {
      setLoading(false)
    }
  }

  const fetchOPRData = async () => {
    try {
      const url = `/api/events/${eventCode}/opr`
      const { data: result } = await cachedFetch<any>(url, BROWSER_CACHE_TTL.OPR)
      const oprData = result.opr || []
      setAllTeamsOPR(oprData)
      setTotalTeams(oprData.length)

      // Sort teams by OPR descending to find rank
      const sortedByOPR = [...oprData].sort((a: any, b: any) => b.opr - a.opr)
      const rank = sortedByOPR.findIndex((team: any) => team.teamNumber === teamNumber) + 1
      setOprRank(rank > 0 ? rank : undefined)
    } catch (error) {
      console.error("Error fetching OPR data:", error)
    }
  }

  useEffect(() => {
    fetchComparison()
    fetchOPRData()
    const interval = setInterval(() => {
      fetchComparison()
      fetchOPRData()
    }, 240000)
    return () => clearInterval(interval)
  }, [eventCode, teamNumber])

  const upcomingMatches = matches.filter(m => !m.played).slice(0, 5)

  return (
    <div className="grid grid-cols-12 gap-3">
      {/* Team Ranking & Performance */}
      <div className="col-span-4">
        <PerformanceModule teamRanking={ranking ? ranking : null} teamStats={teamStats ? teamStats : null} />
      </div>

      {/* Team Statistics with OPR */}
      <div className="col-span-4">
        <DetailedOPRModule
          opr={teamStats?.opr}
          dpr={teamStats?.dpr}
          autoOpr={teamStats?.autoOpr}
          teleopOpr={teamStats?.teleopOpr}
          endgameOpr={teamStats?.endgameOpr}
          matchesPlayed={data?.targetTeam?.played}
          loading={loading}
          error={error}
          oprRank={oprRank}
          totalTeams={totalTeams}
        />
      </div>

      {/* Upcoming Matches */}
      <div className="col-span-4">
        <Card className="h-full flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Upcoming Matches</CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="space-y-1.5">
              {upcomingMatches.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No upcoming matches</p>
              ) : (
                upcomingMatches.map((match) => (
                  <div
                    key={match.matchNumber}
                    className="p-2 rounded border cursor-pointer hover:bg-accent/30 transition-colors"
                    style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}
                    onClick={() => onMatchClick?.(match)}
                  >
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-semibold text-xs">{match.description}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {match.startTime ? new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "TBD"}
                      </span>
                    </div>
                    <div className="text-[11px]">
                      <span style={{ color: 'var(--color-red1)' }}>Red: {teamLabel(match.red1)}, {teamLabel(match.red2)}</span>
                      {" vs "}
                      <span style={{ color: 'var(--color-blue1)' }}>Blue: {teamLabel(match.blue1)}, {teamLabel(match.blue2)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Rankings */}
      <div className="col-span-12">
        <Card>
          <CardHeader className="">
            <CardTitle className="flex items-center text-base">
              Event Rankings
            </CardTitle>
          </CardHeader>
          <CardContent className="">
            {rankings.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No rankings available yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <th className="text-left py-2 px-3 font-semibold text-xs">Rank</th>
                      <th className="text-left py-2 px-3 font-semibold text-xs">Team</th>
                      <th className="text-center py-2 px-3 font-semibold text-xs">RP</th>
                      <th className="text-center py-2 px-3 font-semibold text-xs">TBP</th>
                      <th className="text-center py-2 px-3 font-semibold text-xs">Record</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((r) => (
                      <tr
                        key={r.teamNumber}
                        className={`border-b hover:bg-accent/50 transition-colors ${r.teamNumber === teamNumber ? 'bg-purple-100 dark:bg-purple-950/30' : ''
                          }`}
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs">{r.rank}</span>
                            {r.rank === 1 && <Trophy className="h-3 w-3 text-yellow-500" />}
                            {r.rank <= 3 && r.rank > 1 && <Trophy className="h-3 w-3 text-gray-400" />}
                          </div>
                        </td>
                        <td className="py-2 px-3 font-semibold text-xs">
                          {r.teamNumber} {r.teamName || teamNames[r.teamNumber] || ''}
                        </td>
                        <td className="py-2 px-3 text-center text-xs">{r.rp}</td>
                        <td className="py-2 px-3 text-center text-xs">{r.tbp}</td>
                        <td className="py-2 px-3 text-center text-[11px]">
                          <span className="text-green-600 dark:text-green-400">{r.wins}</span>
                          {" - "}
                          <span className="text-red-600 dark:text-red-400">{r.losses}</span>
                          {" - "}
                          <span className="text-gray-600 dark:text-gray-400">{r.ties}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  )
}
