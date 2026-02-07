"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Match } from "@/app/dashboard/[eventCode]/[teamNumber]/page"

interface ScoreBreakdown {
  alliance: string
  autoPoints?: number
  dcPoints?: number
  endgamePoints?: number
  penaltyPointsCommitted?: number
  totalPoints?: number
  [key: string]: unknown
}

interface MatchScore {
  matchNumber: number
  alliances: ScoreBreakdown[]
}

interface TeamNameMap {
  [teamNumber: number]: string
}

interface MatchDetailDialogProps {
  match: Match | null
  open: boolean
  onOpenChange: (open: boolean) => void
  eventCode: string
  teamNames?: TeamNameMap
}

export function MatchDetailDialog({ match, open, onOpenChange, eventCode, teamNames = {} }: MatchDetailDialogProps) {
  const [scoreData, setScoreData] = useState<MatchScore | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!match || !open) return
    setLoading(true)
    setScoreData(null)

    const level = match.tournamentLevel === 'PLAYOFF' ? 'playoff' : 'qual'
    fetch(`/api/events/${eventCode}/scores?match=${match.matchNumber}&level=${level}`)
      .then(r => r.json())
      .then(data => {
        console.log('Score API response:', JSON.stringify(data, null, 2))
        setScoreData(data.score || null)
      })
      .catch(() => setScoreData(null))
      .finally(() => setLoading(false))
  }, [match, open, eventCode])

  if (!match) return null

  // Helper to find a value from multiple possible field names
  const getVal = (obj: any, ...keys: string[]): number | undefined => {
    if (!obj) return undefined
    for (const key of keys) {
      if (obj[key] != null) return obj[key]
    }
    return undefined
  }

  const redAlliance = scoreData?.alliances?.find((a: any) => a.alliance === 'Red')
  const blueAlliance = scoreData?.alliances?.find((a: any) => a.alliance === 'Blue')

  const teamLabel = (num: number) => {
    const name = teamNames[num]
    return name ? `${num} ${name}` : `${num}`
  }

  // Build score breakdown rows dynamically based on available fields
  const buildBreakdownRows = () => {
    const ref = redAlliance || blueAlliance
    if (!ref) return []

    const rows: { label: string; redKey: string[]; blueKey: string[]; bold?: boolean; color?: string }[] = []

    // Auto
    rows.push({ label: 'Autonomous', redKey: ['autoPoints', 'autonomousPoints'], blueKey: ['autoPoints', 'autonomousPoints'] })

    // TeleOp
    if (getVal(ref, 'dcPoints', 'teleopPoints', 'teleOpPoints', 'driverControlledPoints', 'teleopBasePoints') != null) {
      rows.push({ label: 'TeleOp', redKey: ['dcPoints', 'teleopPoints', 'teleOpPoints', 'driverControlledPoints', 'teleopBasePoints'], blueKey: ['dcPoints', 'teleopPoints', 'teleOpPoints', 'driverControlledPoints', 'teleopBasePoints'] })
    }

    // Endgame (only if this season has it)
    if (getVal(ref, 'endgamePoints', 'endGamePoints') != null) {
      rows.push({ label: 'Endgame', redKey: ['endgamePoints', 'endGamePoints'], blueKey: ['endgamePoints', 'endGamePoints'] })
    }

    // Penalties
    if (getVal(ref, 'penaltyPointsCommitted', 'foulPointsCommitted', 'penaltyPoints') != null) {
      rows.push({ label: 'Fouls', redKey: ['penaltyPointsCommitted', 'foulPointsCommitted', 'penaltyPoints'], blueKey: ['penaltyPointsCommitted', 'foulPointsCommitted', 'penaltyPoints'], color: 'text-yellow-500' })
    }

    return rows
  }

  const breakdownRows = (redAlliance || blueAlliance) ? buildBreakdownRows() : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{match.description}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scoreboard */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Red */}
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', borderLeft: '3px solid var(--color-red1)' }}>
              <div className="text-xs text-muted-foreground mb-1">Red Alliance</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-red1)' }}>{match.redScore}</div>
            </div>

            {/* VS */}
            <div className="flex items-center justify-center">
              {match.played ? (
                <Badge variant={match.redScore > match.blueScore ? 'destructive' : match.blueScore > match.redScore ? 'default' : 'secondary'}>
                  {match.redScore > match.blueScore ? 'Red Wins' : match.blueScore > match.redScore ? 'Blue Wins' : 'Tie'}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">vs</span>
              )}
            </div>

            {/* Blue */}
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', borderRight: '3px solid var(--color-blue1)' }}>
              <div className="text-xs text-muted-foreground mb-1">Blue Alliance</div>
              <div className="text-2xl font-bold" style={{ color: 'var(--color-blue1)' }}>{match.blueScore}</div>
            </div>
          </div>

          {/* Teams */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="text-xs font-semibold" style={{ color: 'var(--color-red1)' }}>Red Teams</div>
              <div className="text-sm font-medium">{teamLabel(match.red1)}</div>
              <div className="text-sm font-medium">{teamLabel(match.red2)}</div>
            </div>
            <div className="space-y-1 text-right">
              <div className="text-xs font-semibold" style={{ color: 'var(--color-blue1)' }}>Blue Teams</div>
              <div className="text-sm font-medium">{teamLabel(match.blue1)}</div>
              <div className="text-sm font-medium">{teamLabel(match.blue2)}</div>
            </div>
          </div>

          {/* Score Breakdown */}
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500 mr-2" />
              <span className="text-sm text-muted-foreground">Loading score details...</span>
            </div>
          ) : scoreData && (redAlliance || blueAlliance) ? (
            <div>
              <div className="text-xs font-semibold mb-2 text-muted-foreground">Score Breakdown</div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                    <th className="py-1.5 text-left text-xs font-medium">Phase</th>
                    <th className="py-1.5 text-right text-xs font-medium" style={{ color: 'var(--color-red1)' }}>Red</th>
                    <th className="py-1.5 text-right text-xs font-medium" style={{ color: 'var(--color-blue1)' }}>Blue</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdownRows.map((row) => (
                    <tr key={row.label} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <td className="py-1.5 text-xs">{row.label}</td>
                      <td className={`py-1.5 text-right font-mono text-xs ${row.color || ''}`}>{getVal(redAlliance, ...row.redKey) ?? '-'}</td>
                      <td className={`py-1.5 text-right font-mono text-xs ${row.color || ''}`}>{getVal(blueAlliance, ...row.blueKey) ?? '-'}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-1.5 text-xs font-bold">Total</td>
                    <td className="py-1.5 text-right font-mono text-xs font-bold">{getVal(redAlliance, 'totalPoints') ?? match.redScore}</td>
                    <td className="py-1.5 text-right font-mono text-xs font-bold">{getVal(blueAlliance, 'totalPoints') ?? match.blueScore}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : match.played ? (
            <div className="text-xs text-muted-foreground text-center py-2">
              Detailed score breakdown not available for this match
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-2">
              Match has not been played yet
              {match.startTime && (
                <span> - Scheduled: {new Date(match.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
