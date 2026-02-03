"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Crown, Calendar, MapPin } from "lucide-react"

interface Match {
  matchNumber: number
  description: string
  startTime: string
  red1: number
  red2: number
  blue1: number
  blue2: number
  redScore: number
  blueScore: number
  played: boolean
  tournamentLevel: string
  series?: number
  matchInSeries?: number
}

interface Alliance {
  number: number
  captain: number
  round1: number
  round2: number
  backup?: number
  name?: string
}

interface FullTournamentBracketProps {
  matches: Match[]
  alliances: Alliance[]
  teamNumber?: number
  eventName?: string
}

interface BracketMatch {
  id: string
  round: string
  series: number
  matchInSeries: number
  alliance1: number
  alliance2: number
  score1?: number
  score2?: number
  winner?: number
  played: boolean
  teams1: number[]
  teams2: number[]
  startTime?: string
}

export function FullTournamentBracket({ matches, alliances, teamNumber, eventName }: FullTournamentBracketProps) {
  // Transform playoff matches into bracket format
  const playoffMatches = matches.filter(
    (m) => m.tournamentLevel !== "Qualification" && !m.description.toLowerCase().includes("qual"),
  )

  // Group matches by series and round
  const bracketMatches: BracketMatch[] = []

  playoffMatches.forEach((match) => {
    // Try to determine alliance numbers from team numbers
    const redAlliance = alliances.find(
      (a) =>
        a.captain === match.red1 ||
        a.round1 === match.red1 ||
        a.round2 === match.red1 ||
        a.captain === match.red2 ||
        a.round1 === match.red2 ||
        a.round2 === match.red2,
    )
    const blueAlliance = alliances.find(
      (a) =>
        a.captain === match.blue1 ||
        a.round1 === match.blue1 ||
        a.round2 === match.blue1 ||
        a.captain === match.blue2 ||
        a.round1 === match.blue2 ||
        a.round2 === match.blue2,
    )

    if (redAlliance && blueAlliance) {
      const winner = match.played
        ? match.redScore > match.blueScore
          ? redAlliance.number
          : match.blueScore > match.redScore
            ? blueAlliance.number
            : undefined
        : undefined

      bracketMatches.push({
        id: `${match.series || 1}-${match.matchInSeries || 1}`,
        round: match.description.includes("Final")
          ? "Finals"
          : match.description.includes("Semi")
            ? "Semifinals"
            : "Quarterfinals",
        series: match.series || 1,
        matchInSeries: match.matchInSeries || 1,
        alliance1: redAlliance.number,
        alliance2: blueAlliance.number,
        score1: match.played ? match.redScore : undefined,
        score2: match.played ? match.blueScore : undefined,
        winner,
        played: match.played,
        teams1: [redAlliance.captain, redAlliance.round1, redAlliance.round2].filter(Boolean),
        teams2: [blueAlliance.captain, blueAlliance.round1, blueAlliance.round2].filter(Boolean),
        startTime: match.startTime,
      })
    }
  })

  // Group by round
  const rounds = {
    Quarterfinals: bracketMatches.filter((m) => m.round === "Quarterfinals"),
    Semifinals: bracketMatches.filter((m) => m.round === "Semifinals"),
    Finals: bracketMatches.filter((m) => m.round === "Finals"),
  }

  const isTeamInAlliance = (teams: number[]) => teamNumber && teams.includes(teamNumber)

  const AllianceDisplay = ({
    allianceNumber,
    teams,
    score,
    isWinner,
    isHighlighted,
    showTime,
    startTime,
  }: {
    allianceNumber: number
    teams: number[]
    score?: number
    isWinner?: boolean
    isHighlighted?: boolean
    showTime?: boolean
    startTime?: string
  }) => (
    <div
      className={`p-4 rounded-lg border-2 transition-all ${
        isHighlighted
          ? "border-blue-400 bg-blue-50 dark:bg-blue-950 shadow-lg"
          : isWinner
            ? "border-green-400 bg-green-50 dark:bg-green-950 shadow-md"
            : "border-gray-200 bg-gray-50 dark:bg-gray-800 hover:border-gray-300"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <Badge variant={isWinner ? "default" : "outline"} className="text-sm font-semibold">
          Alliance {allianceNumber}
          {isWinner && <Crown className="h-4 w-4 ml-1" />}
        </Badge>
        {score !== undefined && (
          <span className={`font-bold text-2xl ${isWinner ? "text-green-600" : "text-gray-600"}`}>{score}</span>
        )}
      </div>
      <div className="space-y-2">
        {teams.map((team, index) => (
          <div
            key={team}
            className={`text-sm flex items-center gap-2 ${
              team === teamNumber
                ? "font-bold text-blue-600 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded"
                : "text-gray-700 dark:text-gray-300"
            }`}
          >
            <span className="text-xs">{index === 0 ? "🏆" : index === 1 ? "1️⃣" : "2️⃣"}</span>
            <span className="font-mono">{team}</span>
          </div>
        ))}
      </div>
      {showTime && startTime && (
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(startTime).toLocaleTimeString()}
        </div>
      )}
    </div>
  )

  const BracketMatchCard = ({ match, showDetails = false }: { match: BracketMatch; showDetails?: boolean }) => {
    const isTeamInvolved = isTeamInAlliance(match.teams1) || isTeamInAlliance(match.teams2)
    const alliance1Highlighted = !!isTeamInAlliance(match.teams1)
    const alliance2Highlighted = !!isTeamInAlliance(match.teams2)

    return (
      <Card className={`${isTeamInvolved ? "ring-2 ring-blue-400 shadow-lg" : "hover:shadow-md"} transition-all`}>
        <CardContent className="p-6">
          <div className="text-center mb-4">
            <Badge variant="secondary" className="text-sm font-semibold">
              {match.round} - Series {match.series}
            </Badge>
            {showDetails && match.startTime && (
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(match.startTime).toLocaleString()}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <AllianceDisplay
              allianceNumber={match.alliance1}
              teams={match.teams1}
              score={match.score1}
              isWinner={match.winner === match.alliance1}
              isHighlighted={alliance1Highlighted}
              showTime={!match.played && !showDetails}
              startTime={match.startTime}
            />

            <div className="text-center">
              <div className="text-sm font-bold text-muted-foreground bg-muted rounded-full px-3 py-1 inline-block">
                VS
              </div>
            </div>

            <AllianceDisplay
              allianceNumber={match.alliance2}
              teams={match.teams2}
              score={match.score2}
              isWinner={match.winner === match.alliance2}
              isHighlighted={alliance2Highlighted}
            />
          </div>

          {!match.played && (
            <div className="text-center mt-4">
              <Badge variant="outline" className="text-sm">
                {match.startTime ? "Scheduled" : "Not Scheduled"}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  if (alliances.length === 0) {
    return (
      <div className="text-center py-16">
        <Trophy className="h-16 w-16 mx-auto text-muted-foreground mb-6" />
        <h3 className="text-2xl font-bold mb-4">Tournament Bracket</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          The elimination tournament bracket will appear here after alliance selection is complete and playoff matches
          begin.
        </p>
      </div>
    )
  }

  if (bracketMatches.length === 0) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold flex items-center justify-center gap-3 mb-4">
            <Trophy className="h-8 w-8" />
            {eventName ? `${eventName} Tournament` : "Tournament Bracket"}
          </h2>
          <p className="text-muted-foreground">Alliance selection complete - playoff matches will begin soon</p>
        </div>

        {/* Show all alliances while waiting for playoff matches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Alliance Selection Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {alliances
                .sort((a, b) => a.number - b.number)
                .map((alliance) => {
                  const isTeamInAlliance =
                    teamNumber &&
                    (alliance.captain === teamNumber ||
                      alliance.round1 === teamNumber ||
                      alliance.round2 === teamNumber ||
                      alliance.backup === teamNumber)

                  return (
                    <Card
                      key={alliance.number}
                      className={isTeamInAlliance ? "border-blue-300 bg-blue-50 dark:bg-blue-950 shadow-lg" : ""}
                    >
                      <CardContent className="p-4">
                        <div className="text-center">
                          <Badge variant="outline" className="mb-3 font-semibold">
                            Alliance {alliance.number}
                          </Badge>
                          <div className="space-y-2">
                            <div
                              className={`font-bold ${alliance.captain === teamNumber ? "text-blue-600 bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded" : ""}`}
                            >
                              <div className="text-xs text-muted-foreground">Captain</div>
                              <div className="font-mono">{alliance.captain}</div>
                            </div>
                            <div
                              className={`${alliance.round1 === teamNumber ? "text-blue-600 font-bold bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded" : ""}`}
                            >
                              <div className="text-xs text-muted-foreground">Pick 1</div>
                              <div className="font-mono">{alliance.round1}</div>
                            </div>
                            <div
                              className={`${alliance.round2 === teamNumber ? "text-blue-600 font-bold bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded" : ""}`}
                            >
                              <div className="text-xs text-muted-foreground">Pick 2</div>
                              <div className="font-mono">{alliance.round2}</div>
                            </div>
                            {alliance.backup && (
                              <div
                                className={`${alliance.backup === teamNumber ? "text-blue-600 font-bold bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded" : ""}`}
                              >
                                <div className="text-xs text-muted-foreground">Backup</div>
                                <div className="font-mono">{alliance.backup}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold flex items-center justify-center gap-3 mb-4">
          <Trophy className="h-8 w-8" />
          {eventName ? `${eventName} Tournament` : "Tournament Bracket"}
        </h2>
        <p className="text-muted-foreground">Elimination Tournament Progress</p>
      </div>

      {/* Desktop Bracket Layout */}
      <div className="hidden xl:block">
        <div className="grid grid-cols-3 gap-8 items-start">
          {/* Quarterfinals */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-center flex items-center justify-center gap-2">
              <MapPin className="h-5 w-5" />
              Quarterfinals
            </h3>
            {rounds.Quarterfinals.length > 0 ? (
              rounds.Quarterfinals.map((match) => <BracketMatchCard key={match.id} match={match} />)
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <p>Quarterfinal matches will appear here</p>
              </div>
            )}
          </div>

          {/* Semifinals */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-center flex items-center justify-center gap-2">
              <Trophy className="h-5 w-5" />
              Semifinals
            </h3>
            {rounds.Semifinals.length > 0 ? (
              rounds.Semifinals.map((match) => <BracketMatchCard key={match.id} match={match} />)
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <p>Semifinal matches will appear here</p>
              </div>
            )}
          </div>

          {/* Finals */}
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-center flex items-center justify-center gap-2">
              <Crown className="h-5 w-5" />
              Finals
            </h3>
            {rounds.Finals.length > 0 ? (
              rounds.Finals.map((match) => <BracketMatchCard key={match.id} match={match} showDetails />)
            ) : (
              <div className="text-center text-muted-foreground py-8">
                <p>Championship match will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Stacked Layout */}
      <div className="xl:hidden space-y-8">
        {Object.entries(rounds).map(
          ([roundName, roundMatches]) =>
            roundMatches.length > 0 && (
              <div key={roundName} className="space-y-4">
                <h3 className="text-xl font-bold text-center flex items-center justify-center gap-2">
                  {roundName === "Finals" ? (
                    <Crown className="h-5 w-5" />
                  ) : roundName === "Semifinals" ? (
                    <Trophy className="h-5 w-5" />
                  ) : (
                    <MapPin className="h-5 w-5" />
                  )}
                  {roundName}
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {roundMatches.map((match) => (
                    <BracketMatchCard key={match.id} match={match} showDetails={roundName === "Finals"} />
                  ))}
                </div>
              </div>
            ),
        )}
      </div>

      {/* Enhanced Legend */}
      <Card className="bg-muted/30">
        <CardContent className="p-6">
          <h4 className="font-bold mb-4 text-center">Tournament Legend</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-100 border-2 border-blue-400 rounded flex items-center justify-center">
                <div className="w-2 h-2 bg-blue-600 rounded"></div>
              </div>
              <span>Your Team</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-100 border-2 border-green-400 rounded flex items-center justify-center">
                <Crown className="h-3 w-3 text-green-600" />
              </div>
              <span>Winner</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <span>Alliance Captain</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">1️⃣2️⃣</span>
              <span>Alliance Picks</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
