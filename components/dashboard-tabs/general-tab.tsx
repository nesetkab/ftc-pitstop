"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PerformanceModule } from "../modules/performance-module"
import { DetailedOPRModule } from "../modules/detailed-opr-module"
import { TeamStats, Ranking, Match } from "@/app/dashboard/[eventCode]/[teamNumber]/page"
import type { NexusData } from "@/app/dashboard/[eventCode]/[teamNumber]/page"
import { ComparisonData } from "../team-comparison"
import { Trophy, Timer, Megaphone, Wrench } from "lucide-react"
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
  nexusData?: NexusData | null
}

export function GeneralTab({ eventCode, teamNumber, ranking, teamStats, matches, rankings, teamNames = {}, onMatchClick, nexusData }: GeneralTabProps) {
  const router = useRouter()
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

  const activeNexusMatches = nexusData?.matches?.filter(m =>
    m.status && (m.status.includes("queuing") || m.status.includes("deck") || m.status.includes("field"))
  ) || []

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

      {/* Nexus Section */}
      {nexusData?.available && (
        <>
          {/* Match Queue */}
          <div className={`${nexusData.announcements.length > 0 || nexusData.partsRequests.length > 0 ? 'col-span-6' : 'col-span-12'}`}>
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Timer className="h-4 w-4 text-purple-500" />
                  Match Queue
                  <Badge variant="outline" className="text-[10px] ml-auto border-purple-500 text-purple-400">
                    via ftc.nexus
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {nexusData.nowQueuing && (
                  <div className="mb-3 p-2 rounded-lg border border-purple-500/30" style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)' }}>
                    <span className="text-xs text-muted-foreground">Now Queuing: </span>
                    <span className="font-semibold text-sm">{nexusData.nowQueuing}</span>
                  </div>
                )}
                {activeNexusMatches.length > 0 ? (
                  <div className="space-y-2">
                    {activeNexusMatches.map((m, i) => {
                      const hasTeam = m.redTeams?.some(t => String(t) === String(teamNumber)) || m.blueTeams?.some(t => String(t) === String(teamNumber))
                      return (
                        <div
                          key={i}
                          className={`p-2 rounded border text-sm ${hasTeam ? 'border-purple-500/50' : ''}`}
                          style={{
                            borderColor: hasTeam ? undefined : 'var(--color-border)',
                            backgroundColor: hasTeam ? 'rgba(168, 85, 247, 0.08)' : 'var(--color-card)'
                          }}
                        >
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="font-medium text-xs">{m.label}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{m.status}</Badge>
                          </div>
                          <div className="text-xs">
                            <span style={{ color: 'var(--color-red1)' }}>
                              Red: {m.redTeams?.map(t => teamLabel(t)).join(', ') || 'TBD'}
                            </span>
                            {" vs "}
                            <span style={{ color: 'var(--color-blue1)' }}>
                              Blue: {m.blueTeams?.map(t => teamLabel(t)).join(', ') || 'TBD'}
                            </span>
                          </div>
                          {m.estimatedStartTime && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Est. start: {new Date(m.estimatedStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No matches currently queuing</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Announcements & Parts Requests */}
          {(nexusData.announcements.length > 0 || nexusData.partsRequests.length > 0) && (
            <div className="col-span-6">
              <div className="space-y-3 h-full">
                {nexusData.announcements.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Megaphone className="h-4 w-4 text-yellow-500" />
                        Announcements
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {nexusData.announcements.map((a, i) => (
                          <div key={i} className="p-2 rounded text-sm" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                            <p>{a.text}</p>
                            {a.postedByTeam && (
                              <p className="text-[10px] text-muted-foreground mt-1">Posted by Team {a.postedByTeam}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {nexusData.partsRequests.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-orange-500" />
                        Parts Requests
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {nexusData.partsRequests.map((p, i) => (
                          <div key={i} className="p-2 rounded text-sm flex justify-between" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
                            <span>{p.parts}</span>
                            <Badge variant="outline" className="text-[10px]">Team {p.requestedByTeam}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </>
      )}

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
              <div className="overflow-auto max-h-[500px]">
                <table className="w-full">
                  <thead className="sticky top-0 z-10" style={{ backgroundColor: 'var(--color-card, hsl(var(--card)))' }}>
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
                        className={`border-b hover:bg-accent/50 transition-colors cursor-pointer ${r.teamNumber === teamNumber ? 'bg-purple-100 dark:bg-purple-950/30' : ''
                          }`}
                        style={{ borderColor: 'var(--color-border)' }}
                        onClick={() => router.push(`/dashboard/${eventCode}/${r.teamNumber}`)}
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
