"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Trophy,
  Calendar,
  Clock,
  TrendingUp,
  ArrowLeft,
  Bell,
  RefreshCw,
  AlertCircle,
  Users,
  Target,
  Zap,
  ExternalLink,
  BarChart3,
  Calculator,
  Layout,
  Settings
} from "lucide-react"
import Link from "next/link"
import { TournamentBracket } from "@/components/tournament-bracket"
import { MatchPredictions } from "@/components/match-predictions"
import { TeamComparison } from "@/components/team-comparison"
import { OPRInsights } from "@/components/opr-insights"
import { ThemeToggle } from "@/components/theme-toggle"
import { ModularDashboard } from "@/components/dashboard"
import { AllianceCard } from "@/components/alliance-card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuCheckboxItemProps,
} from "@/components/ui/dropdown-menu"
import * as React from "react"


type Checked = DropdownMenuCheckboxItemProps["checked"]

interface TeamData {
  teamNumber: number;
  displayTeamNumber: string;
  nameFull: string;
  nameShort: string;
  schoolName: string | null;
  city: string;
  stateProv: string;
  country: string;
  website: string | null;
  rookieYear: number;
  robotName: string | null;
  districtCode: string | null;
  homeCMP: string | null;
  homeRegion: string;
  displayLocation: string;
}

export interface TeamStats {
  wins: number
  losses: number
  ties: number
  opr: number
  dpr: number
  ccwm: number
  rank: number
  rp: number
  tbp: number
}

export interface Match {
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

export interface Ranking {
  rank: number
  team: number
  rp: number
  tbp: number
  wins: number
  losses: number
  ties: number
}

export interface Alliance {
  number: number
  captain: number
  captainDisplay?: string
  round1: number
  round1Display?: string
  round2: number
  round2Display?: string
  round3?: number
  backup?: number
  name?: string
}



export default function DashboardPage() {
  const params = useParams()
  const eventCode = params.eventCode as string
  const teamNumber = Number.parseInt(params.teamNumber as string)
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [rankings, setRankings] = useState<Ranking[]>([])
  const [alliances, setAlliances] = useState<Alliance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [nextMatch, setNextMatch] = useState<Match | null>(null)

  const [teamName, setTeamName] = useState<string | null>(null);

  useEffect(() => {
    const storedDataString = localStorage.getItem('selectedTeam');

    if (storedDataString) {
      try {
        const storedDataObject: TeamData = JSON.parse(storedDataString);

        if (storedDataObject && storedDataObject.nameShort) {
          setTeamName(storedDataObject.nameShort);
        }
      } catch (error) {
        console.error("Failed to parse team data from local storage:", error);
      }
    }
  }, []);



  const getRelativeTime = (date: Date): string => {
    const now = new Date();
    // Difference in seconds
    const diffSeconds = (date.getTime() - now.getTime()) / 1000;

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    // Define time units in seconds
    const units: { [key: string]: number } = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1
    };

    for (const unit in units) {
      if (Math.abs(diffSeconds) > units[unit]) {
        const value = Math.round(diffSeconds / units[unit]);
        return rtf.format(value, unit as Intl.RelativeTimeFormatUnit);
      }
    }
    return rtf.format(Math.round(diffSeconds), 'second');
  };

  const TimeAgoDisplay: React.FC<TimeAgoProps> = ({ lastUpdate }) => {
    const [timeAgo, setTimeAgo] = useState<string>('');

    useEffect(() => {
      // Don't run if the date is not set yet
      if (!lastUpdate) return;

      // Set the initial value immediately on mount
      setTimeAgo(getRelativeTime(lastUpdate));

      // Set up an interval to update the time every 5 seconds
      const intervalId = setInterval(() => {
        setTimeAgo(getRelativeTime(lastUpdate));
      }, 5000); // 5000 milliseconds = 5 seconds

      // This is the cleanup function.
      // React runs this when the component unmounts or `lastUpdate` changes.
      return () => {
        clearInterval(intervalId);
      };
    }, [lastUpdate]); // Rerun the effect if lastUpdate ever changes

    if (!lastUpdate) {
      return null; // Or return a loading/placeholder state
    }

    return (
      <span>{timeAgo}</span>
    );
  };

  const [showStatusBar, setShowStatusBar] = React.useState<Checked>(true)

  const fetchData = async () => {
    try {
      setError(null)
      console.log("Fetching dashboard data for team", teamNumber, "at event", eventCode)

      const [statsResponse, matchesResponse, rankingsResponse, alliancesResponse] = await Promise.all([
        fetch(`/api/teams/${teamNumber}/stats/${eventCode}`),
        fetch(`/api/events/${eventCode}/matches?team=${teamNumber}`),
        fetch(`/api/events/${eventCode}/rankings`),
        fetch(`/api/events/${eventCode}/alliances`),
      ])

      console.log("API Response statuses:", {
        stats: statsResponse.status,
        matches: matchesResponse.status,
        rankings: rankingsResponse.status,
        alliances: alliancesResponse.status,
      })

      // Handle each response individually to avoid failing everything if one fails
      let statsData = { stats: null }
      let matchesData = { matches: [] }
      let rankingsData = { rankings: [] }
      let alliancesData = { alliances: [] }

      if (statsResponse.ok) {
        statsData = await statsResponse.json()
      } else {
        console.error("Stats API failed:", await statsResponse.text())
      }

      if (matchesResponse.ok) {
        matchesData = await matchesResponse.json()
      } else {
        console.error("Matches API failed:", await matchesResponse.text())
        setError("Unable to load match data. The event may not have started yet.")
      }

      if (rankingsResponse.ok) {
        rankingsData = await rankingsResponse.json()
      } else {
        console.error("Rankings API failed:", await rankingsResponse.text())
      }

      if (alliancesResponse.ok) {
        alliancesData = await alliancesResponse.json()
      } else {
        console.error("Alliances API failed:", await alliancesResponse.text())
      }

      setTeamStats(statsData.stats)
      setMatches(matchesData.matches || [])
      setRankings(rankingsData.rankings || [])
      setAlliances(alliancesData.alliances || [])

      // Find next match
      const upcomingMatches = (matchesData.matches || []).filter((m: Match) => !m.played)
      setNextMatch(upcomingMatches.length > 0 ? upcomingMatches[0] : null)

      setLastUpdate(new Date())
      console.log("Dashboard data loaded successfully")
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      setError("Failed to load dashboard data. Please check your connection.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [eventCode, teamNumber])

  const teamRanking = rankings.find((r) => r.team === teamNumber)
  const teamAlliance = alliances.find(
    (a) => a.captain === teamNumber || a.round1 === teamNumber || a.round2 === teamNumber || a.backup === teamNumber,
  )

  // Separate matches by type
  const qualificationMatches = matches.filter(
    (m) => m.tournamentLevel === "Qualification" || m.description.toLowerCase().includes("qual"),
  )
  const playoffMatches = matches.filter(
    (m) => m.tournamentLevel !== "Qualification" && !m.description.toLowerCase().includes("qual"),
  )

  const playedQualMatches = qualificationMatches.filter((m) => m.played)
  const upcomingQualMatches = qualificationMatches.filter((m) => !m.played)
  const playedPlayoffMatches = playoffMatches.filter((m) => m.played)
  const upcomingPlayoffMatches = playoffMatches.filter((m) => !m.played)

  const getMatchResult = (match: Match) => {
    const isRed = match.red1 === teamNumber || match.red2 === teamNumber
    const isBlue = match.blue1 === teamNumber || match.blue2 === teamNumber

    if (!match.played) return "upcoming"

    if (isRed) {
      if (match.redScore > match.blueScore) return "win"
      if (match.redScore < match.blueScore) return "loss"
      return "tie"
    } else if (isBlue) {
      if (match.blueScore > match.redScore) return "win"
      if (match.blueScore < match.redScore) return "loss"
      return "tie"
    }
    return "unknown"
  }

  const MatchCard = ({ match, showAlliance = false }: { match: Match; showAlliance?: boolean }) => {
    const result = getMatchResult(match)
    const isRed = match.red1 === teamNumber || match.red2 === teamNumber
    const isBlue = match.blue1 === teamNumber || match.blue2 === teamNumber

    return (
      <Link className="" href={match.played ? `https://ftcscout.org/events/2024/${eventCode}/matches?scores=${eventCode}-${match.tournamentLevel == "PLAYOFF" && match.series ? (20 + match.series).toString().concat("001") : match.matchNumber}` : ""} target={match.played ? "_blank" : ""}>
        <div className={match.played ? "mt-2 mb-2 rounded-lg p-4 space-y-3 border hover:border-purple-400" : "mt-2 mb-2 rounded-lg p-4 space-y-3"}>
          <div className="flex justify-between items-start">
            <div>
              <div className="font-semibold">{match.description}</div>
              {match.startTime && (
                <div className="text-sm text-muted-foreground">{new Date(match.startTime).toLocaleTimeString()}</div>
              )}
            </div>
            <div className="text-right">
              <Badge variant="outline">Match {match.tournamentLevel == "PLAYOFF" && match.series ? match.series : match.matchNumber}</Badge>
              {match.played && (
                <Badge
                  variant={result === "win" ? "win" : result === "loss" ? "destructive" : "tie"}
                  className="ml-2 "
                >
                  {result.toUpperCase()}
                </Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Red Alliance */}
            <div
              className={`p-3 rounded-lg ${isRed ? "bg-red-100 dark:bg-red-900 border-2 border-red-300" : "bg-red-50 dark:bg-red-950"}`}
            >
              <div className="text-center">
                <div className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">Red Alliance</div>
                <div className="space-y-1">
                  <div className={`${match.red1 === teamNumber ? "font-black" : "font-medium"}`}>
                    {match.red1}
                  </div>
                  <div className={`${match.red2 === teamNumber ? "font-black" : "font-medium"}`}>
                    {match.red2}
                  </div>
                </div>
                {match.played && (
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300 mt-2">{match.redScore}</div>
                )}
              </div>
            </div>

            {/* Blue Alliance */}
            <div
              className={`p-3 rounded-lg ${isBlue ? "bg-blue-100 dark:bg-blue-900 border-2 border-blue-300" : "bg-blue-50 dark:bg-blue-950"}`}
            >
              <div className="text-center">
                <div className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">Blue Alliance</div>
                <div className="space-y-1">
                  <div className={`${match.blue1 === teamNumber ? "font-black" : "font-medium"}`}>
                    {match.blue1}
                  </div>
                  <div className={`${match.blue2 === teamNumber ? "font-black" : "font-medium"}`}>
                    {match.blue2}
                  </div>
                </div>
                {match.played && (
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-2">{match.blueScore}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading team dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container mx-auto self-center ">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-black">{teamNumber} - {teamName ? teamName : ""} <span className="text-xl font-extralight">{eventCode.toUpperCase()}</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">last update: <TimeAgoDisplay lastUpdate={lastUpdate} /> </p>

            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3" >
                  <Settings className="h-4 w-4" />
                </div>

              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Theme</DropdownMenuItem>
                <DropdownMenuItem>Change Team</DropdownMenuItem>
                <DropdownMenuItem>Go Home</DropdownMenuItem>
                <DropdownMenuItem>Change Auto-Refresh Delay</DropdownMenuItem>
                <DropdownMenuCheckboxItem
                  checked={showStatusBar}
                  onCheckedChange={setShowStatusBar}
                >
                  Status Bar
                </DropdownMenuCheckboxItem>              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        </div>

        {error && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div className="flex-1">
                  <p className="text-yellow-900 dark:text-yellow-100">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Match Alert */}
        {nextMatch && (
          <Card className="mb-6 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-orange-600" />
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                    Next Match: {nextMatch.description}
                  </h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    {nextMatch.startTime ? new Date(nextMatch.startTime).toLocaleTimeString() : "Time TBD"} • Red:{" "}
                    {nextMatch.red1}, {nextMatch.red2} vs Blue: {nextMatch.blue1}, {nextMatch.blue2}
                  </p>
                </div>
                <Badge variant="secondary">Match {nextMatch.matchNumber}</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Tabs */}
          <div className="lg:col-span-4">
            <Tabs defaultValue="dashboard" className="space-y-6">
              <TabsList className="grid w-full grid-cols-8">
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <Layout className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="qualification" className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <span className="hidden md:inline">Quals ({qualificationMatches.length})</span>
                </TabsTrigger>
                <TabsTrigger value="predictions" className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span className="hidden md:inline">Predictions</span>
                </TabsTrigger>
                <TabsTrigger value="comparison" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span className="hidden md:inline">Compare</span>
                </TabsTrigger>
                <TabsTrigger value="opr" className="flex items-center gap-2">
                  <Calculator className="h-4 w-4" />
                  <span className="hidden md:inline">PR</span>
                </TabsTrigger>
                <TabsTrigger value="bracket" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  <span className="hidden md:inline">Bracket</span>
                </TabsTrigger>
                <TabsTrigger value="playoffs" className="flex items-center gap-2">
                  <Trophy className="h-4 w-4" />
                  <span className="hidden md:inline">Playoffs ({playoffMatches.length})</span>
                </TabsTrigger>
                <TabsTrigger value="alliances" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="hidden md:inline">Alliances ({alliances.length})</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="space-y-6">
                <ModularDashboard eventCode={eventCode} teamNumber={teamNumber} ranking={teamRanking} rankings={rankings} alliance={teamAlliance} teamStats={teamStats} />
              </TabsContent>

              <TabsContent value="qualification" className="space-y-6">
                {/* Upcoming Qualification Matches */}
                {upcomingQualMatches.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Upcoming Qualification Matches
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {upcomingQualMatches.slice(0, 5).map((match) => (
                          <MatchCard key={match.matchNumber} match={match} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Played Qualification Matches */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Qualification Match History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {playedQualMatches
                        .slice(-10)
                        .reverse()
                        .map((match) => (
                          <MatchCard key={match.matchNumber} match={match} />
                        ))}
                      {playedQualMatches.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">No qualification matches played yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="predictions" className="space-y-6">
                <MatchPredictions eventCode={eventCode} teamNumber={teamNumber} />
              </TabsContent>

              <TabsContent value="comparison" className="space-y-6">
                <TeamComparison eventCode={eventCode} teamNumber={teamNumber} />
              </TabsContent>

              <TabsContent value="opr" className="space-y-6">
                <OPRInsights eventCode={eventCode} teamNumber={teamNumber} />
              </TabsContent>

              <TabsContent value="bracket" className="space-y-6">
                <Card>
                  <CardContent className="p-6">
                    <TournamentBracket matches={matches} alliances={alliances} teamNumber={teamNumber} />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="playoffs" className="space-y-6">
                {/* Upcoming Playoff Matches */}
                {upcomingPlayoffMatches.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Upcoming Playoff Matches
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {upcomingPlayoffMatches.map((match) => (
                          <MatchCard key={match.matchNumber} match={match} showAlliance />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Played Playoff Matches */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Playoff Match History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {playedPlayoffMatches.reverse().map((match) => (
                        <MatchCard key={match.description} match={match} showAlliance />
                      ))}
                      {playedPlayoffMatches.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">
                          Playoff matches will appear here after alliance selection
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="alliances" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Alliance Selection
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {alliances.length > 0 ? (
                      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {alliances.map((alliance) => (
                          <AllianceCard key={alliance.number} alliance={alliance} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        Alliance selection has not occurred yet. Alliances will be displayed here after qualification
                        matches are complete.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  )
}
