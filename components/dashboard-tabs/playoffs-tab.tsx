"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alliance, Match } from "@/app/dashboard/[eventCode]/[teamNumber]/page"
import { DoubleEliminationBracket } from "@/components/double-elimination-bracket"
import { useState, useEffect } from "react"

interface PlayoffsTabProps {
  eventCode: string
  teamNumber: number
  alliances: Alliance[]
  matches: Match[]
  teamNames?: { [key: number]: string }
  onMatchClick?: (match: Match) => void
}

export function PlayoffsTab({ eventCode, teamNumber, alliances, matches, teamNames = {}, onMatchClick }: PlayoffsTabProps) {
  const teamLabel = (num: number) => {
    const name = teamNames[num]
    return name ? `${num} ${name}` : `${num}`
  }
  const [allMatches, setAllMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAllMatches = async () => {
      try {
        const response = await fetch(`/api/events/${eventCode}/matches`)
        if (response.ok) {
          const data = await response.json()
          setAllMatches(data.matches || [])
        }
      } catch (error) {
        console.error("Error fetching all matches:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchAllMatches()
    const interval = setInterval(fetchAllMatches, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [eventCode])

  const playoffMatches = allMatches.filter(m => m.tournamentLevel === 'PLAYOFF')
  const hasPick2 = alliances.some(a => a.round2 != null && a.round2 !== 0)

  return (
    <div className="space-y-4">
      {/* Alliance Selection */}
      {alliances.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alliance Selection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              {alliances.map((alliance) => (
                <div
                  key={alliance.number}
                  className="p-4 rounded-lg border"
                  style={{
                    borderColor: 'var(--color-border)',
                    backgroundColor:
                      alliance.captain === teamNumber ||
                      alliance.round1 === teamNumber ||
                      alliance.round2 === teamNumber ||
                      alliance.backup === teamNumber
                        ? 'var(--color-primary)'
                        : 'var(--color-card)',
                    color:
                      alliance.captain === teamNumber ||
                      alliance.round1 === teamNumber ||
                      alliance.round2 === teamNumber ||
                      alliance.backup === teamNumber
                        ? 'var(--color-primary-text)'
                        : 'inherit',
                  }}
                >
                  <div className="font-bold mb-2">Alliance {alliance.number}</div>
                  <div className="text-sm space-y-1">
                    <div>Captain: {teamLabel(alliance.captain)}</div>
                    <div>Pick 1: {teamLabel(alliance.round1)}</div>
                    {hasPick2 && <div>Pick 2: {alliance.round2 ? teamLabel(alliance.round2) : 'N/A'}</div>}
                    {alliance.backup && <div>Backup: {teamLabel(alliance.backup)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Playoff Bracket */}
      <Card>
        <CardHeader>
          <CardTitle>Double Elimination Bracket</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="min-h-[400px] flex items-center justify-center">
              <p className="text-muted-foreground">Loading playoff bracket...</p>
            </div>
          ) : alliances.length >= 4 ? (
            <DoubleEliminationBracket alliances={alliances} playoffMatches={playoffMatches} onMatchClick={onMatchClick} />
          ) : (
            <div className="min-h-[400px] flex items-center justify-center">
              <p className="text-muted-foreground">
                Playoff bracket will appear here once alliance selection is complete (requires 4+ alliances)
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
