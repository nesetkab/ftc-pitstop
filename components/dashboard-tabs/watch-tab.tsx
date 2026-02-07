"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RankingsModule } from "../modules/rankings-module"
import { Ranking, Match } from "@/app/dashboard/[eventCode]/[teamNumber]/page"
import { StreamEmbed } from "../stream-embed"
import { Megaphone, Timer, Wrench } from "lucide-react"

interface NexusMatch {
  label: string
  status: string
  redTeams: number[]
  blueTeams: number[]
  replayOf: string | null
  estimatedStartTime: number | null
  actualStartTime: number | null
  estimatedQueueTime: number | null
}

interface NexusData {
  available: boolean
  reason?: string
  nowQueuing: string | null
  matches: NexusMatch[]
  announcements: { text: string; postedByTeam: string | null }[]
  partsRequests: { parts: string; requestedByTeam: string }[]
  dataAsOfTime: number | null
}

interface WatchTabProps {
  eventCode: string
  teamNumber: number
  rankings: Ranking[]
  matches: Match[]
  teamNames?: { [key: number]: string }
  onMatchClick?: (match: Match) => void
}

export function WatchTab({ eventCode, teamNumber, rankings, matches, teamNames = {}, onMatchClick }: WatchTabProps) {
  const teamLabel = (num: number) => {
    const name = teamNames[num]
    return name ? `${num} ${name}` : `${num}`
  }
  const [nexusData, setNexusData] = useState<NexusData | null>(null)
  const [nexusLoading, setNexusLoading] = useState(true)

  const upcomingMatches = matches.filter(m => !m.played).slice(0, 10)

  useEffect(() => {
    const fetchNexus = async () => {
      try {
        const response = await fetch(`/api/events/${eventCode}/nexus`)
        const data = await response.json()
        setNexusData(data)
      } catch {
        setNexusData({ available: false, reason: "Failed to check", nowQueuing: null, matches: [], announcements: [], partsRequests: [], dataAsOfTime: null })
      } finally {
        setNexusLoading(false)
      }
    }

    fetchNexus()
    // Refresh Nexus data every 30 seconds
    const interval = setInterval(fetchNexus, 30000)
    return () => clearInterval(interval)
  }, [eventCode])

  // Find active/queuing matches from Nexus
  const activeNexusMatches = nexusData?.matches?.filter(m =>
    m.status && (m.status.includes("queuing") || m.status.includes("deck") || m.status.includes("field"))
  ) || []

  // Check if our team is in any upcoming Nexus match
  const teamNexusMatch = nexusData?.matches?.find(m =>
    m.redTeams?.includes(teamNumber) || m.blueTeams?.includes(teamNumber)
  )

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Stream Embed */}
      <div className="col-span-8">
        <Card>
          <CardHeader>
            <CardTitle>Live Stream</CardTitle>
          </CardHeader>
          <CardContent>
            <StreamEmbed eventCode={eventCode} />
          </CardContent>
        </Card>

        {/* Nexus Queue Status */}
        {nexusData?.available && (
          <Card className="mt-4">
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
                    const hasTeam = m.redTeams?.includes(teamNumber) || m.blueTeams?.includes(teamNumber)
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
        )}

        {/* Nexus Announcements */}
        {nexusData?.available && nexusData.announcements.length > 0 && (
          <Card className="mt-4">
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

        {/* Nexus Parts Requests */}
        {nexusData?.available && nexusData.partsRequests.length > 0 && (
          <Card className="mt-4">
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

        {/* Upcoming Matches (from FTC API) */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Upcoming Matches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming matches</p>
              ) : (
                upcomingMatches.map((match) => {
                  const hasTeam = match.red1 === teamNumber || match.red2 === teamNumber ||
                    match.blue1 === teamNumber || match.blue2 === teamNumber
                  return (
                    <div
                      key={match.matchNumber}
                      className={`p-3 rounded-lg border cursor-pointer hover:bg-accent/30 transition-colors ${hasTeam ? 'border-purple-500/50' : ''}`}
                      style={{
                        borderColor: hasTeam ? undefined : 'var(--color-border)',
                        backgroundColor: hasTeam ? 'rgba(168, 85, 247, 0.08)' : 'var(--color-card)'
                      }}
                      onClick={() => onMatchClick?.(match)}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-semibold text-sm">{match.description}</span>
                        <span className="text-xs text-muted-foreground">
                          {match.startTime ? new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "TBD"}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span style={{ color: 'var(--color-red1)' }}>
                          Red: {teamLabel(match.red1)}, {teamLabel(match.red2)}
                        </span>
                        {" vs "}
                        <span style={{ color: 'var(--color-blue1)' }}>
                          Blue: {teamLabel(match.blue1)}, {teamLabel(match.blue2)}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <div className="col-span-4">
        <RankingsModule rankings={rankings} teamNumber={teamNumber} teamNames={teamNames} />

        {/* Nexus status indicator */}
        {!nexusLoading && (
          <div className="mt-3 text-center">
            {nexusData?.available ? (
              <Badge variant="outline" className="text-[10px] border-green-500/50 text-green-400">
                ftc.nexus connected
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] border-muted text-muted-foreground">
                ftc.nexus not available for this event
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
