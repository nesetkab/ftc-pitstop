"use client"

import { Alliance, Match } from "@/app/dashboard/[eventCode]/[teamNumber]/page"

interface DoubleEliminationBracketProps {
  alliances: Alliance[]
  playoffMatches: Match[]
  onMatchClick?: (match: Match) => void
}

export function DoubleEliminationBracket({ alliances, playoffMatches, onMatchClick }: DoubleEliminationBracketProps) {
  const getAllianceNumber = (teamNumber: number) => {
    const alliance = alliances.find(a => a.captain === teamNumber)
    return alliance ? alliance.number : null
  }

  const getWinner = (match: Match) => {
    if (!match.played) return null
    if (match.redScore > match.blueScore) return 'red'
    if (match.blueScore > match.redScore) return 'blue'
    return 'tie'
  }

  // Map playoff matches by series number
  // Series: 1,2 = Winners R1, 3 = Losers R2, 4 = Winners Final, 5 = Losers Final, 6 = Grand Final
  const matchBySeries: { [key: number]: Match } = {}
  playoffMatches.forEach(match => {
    if (match.series) {
      matchBySeries[match.series] = match
    }
  })

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
          className="flex flex-col gap-1.5 p-3 rounded-lg border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}
        >
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="flex justify-between items-center px-3 py-2 rounded" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
            <span className="text-sm text-muted-foreground">TBD</span>
            <span className="text-sm text-muted-foreground">-</span>
          </div>
          <div className="flex justify-between items-center px-3 py-2 rounded" style={{ backgroundColor: 'var(--color-background-secondary)' }}>
            <span className="text-sm text-muted-foreground">TBD</span>
            <span className="text-sm text-muted-foreground">-</span>
          </div>
        </div>
      )
    }

    const winner = getWinner(match)
    const redWon = winner === 'red'
    const blueWon = winner === 'blue'

    return (
      <div
        className="flex flex-col gap-1.5 p-3 rounded-lg border cursor-pointer hover:bg-accent/30 transition-colors"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}
        onClick={() => onMatchClick?.(match)}
      >
        <div className="text-xs font-medium text-muted-foreground">{label}</div>

        {/* Red Alliance */}
        <div
          className="flex justify-between items-center px-3 py-2 rounded transition-opacity"
          style={{
            backgroundColor: redWon ? 'rgba(34, 197, 94, 0.2)' : 'var(--color-background-secondary)',
            borderLeft: '3px solid var(--color-red1)',
            opacity: blueWon ? 0.5 : 1
          }}
        >
          <span className={`text-sm ${redWon ? 'font-bold' : 'font-medium'}`}>
            Alliance {getAllianceNumber(match.red1) || '?'}
          </span>
          {match.played && <span className={`text-sm ${redWon ? 'font-bold' : ''}`}>{match.redScore}</span>}
        </div>

        {/* Blue Alliance */}
        <div
          className="flex justify-between items-center px-3 py-2 rounded transition-opacity"
          style={{
            backgroundColor: blueWon ? 'rgba(34, 197, 94, 0.2)' : 'var(--color-background-secondary)',
            borderLeft: '3px solid var(--color-blue1)',
            opacity: redWon ? 0.5 : 1
          }}
        >
          <span className={`text-sm ${blueWon ? 'font-bold' : 'font-medium'}`}>
            Alliance {getAllianceNumber(match.blue1) || '?'}
          </span>
          {match.played && <span className={`text-sm ${blueWon ? 'font-bold' : ''}`}>{match.blueScore}</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[900px] space-y-6">
        {/* Winners Bracket */}
        <div>
          <h3 className="text-sm font-bold mb-3 text-green-500">Winners Bracket</h3>
          <div className="grid grid-cols-3 gap-6 items-center">
            {/* Col 1: Winners R1 */}
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground text-center mb-2">Round 1</div>
              {renderMatch(winnersRound1Match1, 'Match 1')}
              {renderMatch(winnersRound1Match2, 'Match 2')}
            </div>

            {/* Col 2: Winners Final */}
            <div>
              <div className="text-xs text-muted-foreground text-center mb-2">Winners Final</div>
              {renderMatch(winnersFinal, 'Winners Final')}
            </div>

            {/* Col 3: Grand Final */}
            <div>
              <div className="text-xs text-center mb-2 font-semibold text-purple-400">Grand Final</div>
              {renderMatch(grandFinal, 'Grand Final')}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />

        {/* Losers Bracket */}
        <div>
          <h3 className="text-sm font-bold mb-3 text-red-400">Losers Bracket</h3>
          <div className="grid grid-cols-3 gap-6 items-center">
            {/* Col 1: Empty */}
            <div />

            {/* Col 2: Losers Round 2 */}
            <div>
              <div className="text-xs text-muted-foreground text-center mb-2">Losers Round 2</div>
              {renderMatch(losersRound2, 'Losers Round 2')}
            </div>

            {/* Col 3: Losers Final */}
            <div>
              <div className="text-xs text-muted-foreground text-center mb-2">Losers Final</div>
              {renderMatch(losersFinal, 'Losers Final')}
            </div>
          </div>
        </div>

        {/* Flow description */}
        <div className="text-xs text-muted-foreground space-y-1 pt-2">
          <p>Winners of Round 1 advance to Winners Final. Losers drop to Losers Bracket.</p>
          <p>Loser of Winners Final plays winner of Losers Round 2 in Losers Final.</p>
          <p>Winner of Winners Final vs winner of Losers Final in Grand Final.</p>
        </div>

        {playoffMatches.length > 0 && (
          <div className="text-xs text-muted-foreground text-center pt-2">
            {playoffMatches.filter(m => m.played).length} of {playoffMatches.length} playoff matches completed
          </div>
        )}
      </div>
    </div>
  )
}
