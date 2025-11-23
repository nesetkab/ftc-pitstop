"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Alliance, Match } from "@/app/dashboard/[eventCode]/[teamNumber]/page"

interface DoubleEliminationBracketProps {
  alliances: Alliance[]
  playoffMatches: Match[]
}

export function DoubleEliminationBracket({ alliances, playoffMatches }: DoubleEliminationBracketProps) {
  // Helper function to get alliance number by captain
  const getAllianceNumber = (teamNumber: number) => {
    const alliance = alliances.find(a => a.captain === teamNumber)
    return alliance ? alliance.number : null
  }

  // Helper function to determine winner of a match
  const getWinner = (match: Match) => {
    if (!match.played) return null
    if (match.redScore > match.blueScore) return 'red'
    if (match.blueScore > match.redScore) return 'blue'
    return 'tie'
  }

  // Map playoff matches by series number
  const matchBySeries: { [key: number]: Match } = {}
  playoffMatches.forEach(match => {
    if (match.series) {
      matchBySeries[match.series] = match
    }
  })

  // Series mapping:
  // 1, 2: Winners Round 1
  // 3: Losers Round 2
  // 4: Winners Final
  // 5: Losers Final
  // 6: Grand Final

  const winnersRound1Match1 = matchBySeries[1]
  const winnersRound1Match2 = matchBySeries[2]
  const losersRound2 = matchBySeries[3]
  const winnersFinal = matchBySeries[4]
  const losersFinal = matchBySeries[5]
  const grandFinal = matchBySeries[6]

  const renderMatch = (match: Match | undefined, label: string) => {
    if (!match) {
      return (
        <div
          className="flex flex-col gap-1 p-3 rounded border min-w-[200px]"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}
        >
          <div className="text-xs text-muted-foreground mb-1">{label}</div>
          <div className="flex justify-between items-center p-2 rounded" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
            <span className="font-semibold">TBD</span>
          </div>
          <div className="flex justify-between items-center p-2 rounded" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
            <span className="font-semibold">TBD</span>
          </div>
        </div>
      )
    }

    const winner = getWinner(match)
    const redWon = winner === 'red'
    const blueWon = winner === 'blue'

    return (
      <div
        className="flex flex-col gap-1 p-3 rounded border min-w-[200px]"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}
      >
        <div className="text-xs text-muted-foreground mb-1">{label}</div>

        {/* Red Alliance */}
        <div
          className="flex justify-between items-center p-2 rounded"
          style={{
            backgroundColor: redWon ? 'var(--color-success)' : 'var(--color-background-secondary)',
            opacity: blueWon ? 0.6 : 1
          }}
        >
          <span className={`font-semibold ${redWon ? 'font-bold' : ''}`}>
            Alliance {getAllianceNumber(match.red1) || '?'}
          </span>
          {match.played && <span className="font-bold">{match.redScore}</span>}
        </div>

        {/* Blue Alliance */}
        <div
          className="flex justify-between items-center p-2 rounded"
          style={{
            backgroundColor: blueWon ? 'var(--color-success)' : 'var(--color-background-secondary)',
            opacity: redWon ? 0.6 : 1
          }}
        >
          <span className={`font-semibold ${blueWon ? 'font-bold' : ''}`}>
            Alliance {getAllianceNumber(match.blue1) || '?'}
          </span>
          {match.played && <span className="font-bold">{match.blueScore}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[1200px] p-6 relative">
        {/* SVG for connecting lines - positioned absolutely to overlay the bracket */}
        <svg
          className="absolute pointer-events-none"
          style={{
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 0
          }}
          viewBox="0 0 1200 650"
          preserveAspectRatio="none"
        >
          {/* Winners Round 1 Match 1 to Winners Final (winner - green) */}
          <path d="M 210 110 L 270 110 L 270 210 L 330 210" stroke="#22c55e" strokeWidth="3" fill="none" opacity="0.7" />

          {/* Winners Round 1 Match 1 to Losers Round 2 (loser - red) */}
          <path d="M 210 110 L 240 110 L 240 470 L 330 470" stroke="#ef4444" strokeWidth="3" fill="none" opacity="0.7" strokeDasharray="8,4" />

          {/* Winners Round 1 Match 2 to Winners Final (winner - green) */}
          <path d="M 210 250 L 270 250 L 270 210 L 330 210" stroke="#22c55e" strokeWidth="3" fill="none" opacity="0.7" />

          {/* Winners Round 1 Match 2 to Losers Round 2 (loser - red) */}
          <path d="M 210 250 L 240 250 L 240 470 L 330 470" stroke="#ef4444" strokeWidth="3" fill="none" opacity="0.7" strokeDasharray="8,4" />

          {/* Winners Final to Grand Final (winner - green) */}
          <path d="M 530 210 L 830 210" stroke="#22c55e" strokeWidth="3" fill="none" opacity="0.7" />

          {/* Winners Final to Losers Final (loser - red) */}
          <path d="M 530 210 L 600 210 L 600 470 L 630 470" stroke="#ef4444" strokeWidth="3" fill="none" opacity="0.7" strokeDasharray="8,4" />

          {/* Losers Round 2 to Losers Final (winner - green) */}
          <path d="M 530 470 L 630 470" stroke="#22c55e" strokeWidth="3" fill="none" opacity="0.7" />

          {/* Losers Final to Grand Final (winner - green) */}
          <path d="M 830 470 L 900 470 L 900 210 L 830 210" stroke="#22c55e" strokeWidth="3" fill="none" opacity="0.7" />
        </svg>

        {/* Winners Bracket */}
        <div className="mb-8 relative" style={{ zIndex: 1 }}>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-primary)' }}>Winners Bracket</h2>
          <div className="grid grid-cols-4 gap-8 items-center">
            {/* Column 1: Winners Round 1 */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-center mb-4">Round 1</h3>
              <div className="flex flex-col gap-12">
                {renderMatch(winnersRound1Match1, 'Match 1')}
                {renderMatch(winnersRound1Match2, 'Match 2')}
              </div>
            </div>

            {/* Column 2: Winners Final */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-center mb-4">Winners Final</h3>
              <div className="flex items-center justify-center h-full">
                {renderMatch(winnersFinal, 'Winners Final')}
              </div>
            </div>

            {/* Column 3: Empty (for spacing) */}
            <div></div>

            {/* Column 4: Grand Final */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-center mb-4" style={{ color: 'var(--color-success)' }}>Grand Final</h3>
              <div className="flex items-center justify-center h-full">
                {renderMatch(grandFinal, 'Grand Final')}
              </div>
            </div>
          </div>
        </div>

        {/* Losers Bracket */}
        <div className="pt-8 border-t-2 relative" style={{ borderColor: 'var(--color-border)', zIndex: 1 }}>
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--color-error)' }}>Losers Bracket</h2>
          <div className="grid grid-cols-4 gap-8 items-center">
            {/* Column 1: Empty (aligns with Winners Round 1) */}
            <div></div>

            {/* Column 2: Losers Round 2 */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-center mb-4">Losers Round 2</h3>
              <div className="flex items-center justify-center">
                {renderMatch(losersRound2, 'Losers Round 2')}
              </div>
            </div>

            {/* Column 3: Losers Final */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-center mb-4">Losers Final</h3>
              <div className="flex items-center justify-center">
                {renderMatch(losersFinal, 'Losers Final')}
              </div>
            </div>

            {/* Column 4: Empty (aligns with Grand Final) */}
            <div></div>
          </div>
        </div>

        {/* Bracket Legend */}
        <div className="mt-8 p-4 rounded border relative" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)', zIndex: 1 }}>
          <div className="flex gap-6 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-primary)' }}></div>
              <span>Winners Bracket</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-error)' }}></div>
              <span>Losers Bracket</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--color-success)' }}></div>
              <span>Winner</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5" style={{ backgroundColor: '#22c55e' }}></div>
              <span>Winner Path</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5" style={{ backgroundColor: '#ef4444', backgroundImage: 'repeating-linear-gradient(90deg, #ef4444, #ef4444 5px, transparent 5px, transparent 10px)' }}></div>
              <span>Loser Path</span>
            </div>
          </div>
        </div>

        {/* Match results info */}
        {playoffMatches.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground text-center relative" style={{ zIndex: 1 }}>
            <p>Showing {playoffMatches.filter(m => m.played).length} of {playoffMatches.length} playoff matches completed</p>
          </div>
        )}

        {/* Tournament Flow Note */}
        <div className="mt-4 text-xs text-muted-foreground text-center relative" style={{ zIndex: 1 }}>
          <p>Winners Final and Losers Round 2 are played simultaneously</p>
        </div>
      </div>
    </div>
  )
}
