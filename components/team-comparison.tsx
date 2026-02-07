"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  TrendingUp,
  Trophy,
  Target,
  Shield,
  Zap,
  Users,
  RefreshCw,
  AlertTriangle,
  Search,
  Medal,
  BarChart3,
  Percent,
} from "lucide-react"

interface TeamStats {
  teamNumber: number
  rank: number
  rp: number
  tbp: number
  wins: number
  losses: number
  ties: number
  played: number
  winRate: number
  opr: number
  dpr: number
  autoOpr?: number
  teleopOpr?: number
  endgameOpr?: number
  avgScore: number
  highScore: number
  avgMargin: number
}

interface TeamComparisonProps {
  eventCode: string
  teamNumber?: number
}

export interface ComparisonData {
  targetTeam: TeamStats | null
  allTeams: TeamStats[]
  similarTeams: TeamStats[]
  topPerformers: {
    opr: TeamStats[]
    dpr: TeamStats[]
    winRate: TeamStats[]
    avgScore: TeamStats[]
    highScore: TeamStats[]
  }
  percentiles: {
    rank: number
    opr: number
    dpr: number
    winRate: number
    avgScore: number
    avgMargin: number
  } | null
  eventStats: {
    totalTeams: number
    avgOPR: number
    avgScore: number
    highestScore: number
  }
}

export function TeamComparison({ eventCode, teamNumber }: TeamComparisonProps) {
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [compareTeam, setCompareTeam] = useState<number | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchComparison = async () => {
    try {
      setError(null)
      console.log("Fetching team comparison for event:", eventCode)

      const url = teamNumber
        ? `/api/events/${eventCode}/team-comparison?team=${teamNumber}`
        : `/api/events/${eventCode}/team-comparison`

      const response = await fetch(url)
      const result = await response.json()

      if (response.ok) {
        setData(result)
        setLastUpdate(new Date())
        console.log(`Loaded comparison data for ${result.allTeams?.length || 0} teams`)
      } else {
        setError("Unable to load team comparison data")
      }
    } catch (error) {
      console.error("Error fetching comparison:", error)
      setError("Failed to load comparison data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchComparison()

    // Refresh every 2 minutes
    const interval = setInterval(fetchComparison, 120000)
    return () => clearInterval(interval)
  }, [eventCode, teamNumber])

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 80) return "text-green-600"
    if (percentile >= 60) return "text-blue-600"
    if (percentile >= 40) return "text-yellow-600"
    return "text-red-600"
  }

  const getPercentileDescription = (percentile: number) => {
    if (percentile >= 90) return "Excellent"
    if (percentile >= 75) return "Very Good"
    if (percentile >= 60) return "Good"
    if (percentile >= 40) return "Average"
    if (percentile >= 25) return "Below Average"
    return "Needs Improvement"
  }

  const filteredTeams =
    data?.allTeams.filter((team) => team.teamNumber.toString().includes(searchTerm) || searchTerm === "") || []

  const TeamCard = ({
    team,
    highlight = false,
    showComparison = false,
  }: {
    team: TeamStats
    highlight?: boolean
    showComparison?: boolean
  }) => {
    const isTarget = team.teamNumber === teamNumber
    const isCompare = team.teamNumber === compareTeam

    return (
      <Card
        className={`${highlight || isTarget
          ? "border-purple-300 bg-purple-50 dark:bg-purple-950"
          : isCompare
            ? "border-green-300 bg-green-50 dark:bg-green-950"
            : ""
          } ${showComparison ? "cursor-pointer hover:shadow-md" : ""}`}
        onClick={showComparison ? () => setCompareTeam(team.teamNumber) : undefined}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="font-mono">
                  #{team.teamNumber}
                </Badge>
                {isTarget && <Badge variant="default">Your Team</Badge>}
                {isCompare && <Badge variant="secondary">Comparing</Badge>}
              </div>
              <div className="text-sm text-muted-foreground">
                Rank #{team.rank} • {team.wins}-{team.losses}-{team.ties}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{team.winRate.toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">Win Rate</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="flex justify-between">
                <span>OPR:</span>
                <span className="font-semibold">{team.opr.toFixed(1)}</span>
              </div>
              <div className="flex justify-between">
                <span>DPR:</span>
                <span className="font-semibold">{team.dpr.toFixed(1)}</span>
              </div>
            </div>
            <div>
              <div className="flex justify-between">
                <span>Avg Score:</span>
                <span className="font-semibold">{team.avgScore.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span>High Score:</span>
                <span className="font-semibold">{team.highScore}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Margin:</span>
                <span className={`font-semibold ${team.avgMargin >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {team.avgMargin >= 0 ? "+" : ""}
                  {team.avgMargin.toFixed(0)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const PercentileCard = ({
    title,
    value,
    percentile,
    icon: Icon,
  }: {
    title: string
    value: string
    percentile: number
    icon: any
  }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{title}</span>
          </div>
          <Badge variant="outline" className={getPercentileColor(percentile)}>
            {percentile}%
          </Badge>
        </div>
        <div className="text-2xl font-bold mb-2">{value}</div>
        <div className="space-y-1">
          <Progress value={percentile} className="h-2" />
          <div className={`text-xs ${getPercentileColor(percentile)}`}>{getPercentileDescription(percentile)}</div>
        </div>
      </CardContent>
    </Card>
  )

  const TopPerformersList = ({
    teams,
    metric,
    title,
  }: {
    teams: TeamStats[]
    metric: keyof TeamStats
    title: string
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {teams.map((team, index) => (
            <div key={team.teamNumber} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <Badge variant={index === 0 ? "default" : "outline"}>
                  {index === 0 ? <Medal className="h-3 w-3 mr-1" /> : null}#{index + 1}
                </Badge>
                <span className={`font-mono ${team.teamNumber === teamNumber ? "font-bold text-purple-500" : ""}`}>
                  {team.teamNumber}
                </span>
              </div>
              <span className="font-semibold">
                {typeof team[metric] === "number"
                  ? metric === "winRate"
                    ? `${team[metric].toFixed(0)}%`
                    : team[metric].toFixed(1)
                  : team[metric]}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
        <p>Loading team comparison data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-4" />
          <p className="text-yellow-900 dark:text-yellow-100">{error}</p>
          <Button variant="outline" onClick={fetchComparison} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.allTeams.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Comparison Data Available</h3>
          <p className="text-muted-foreground">
            Team comparison data will appear here once matches have been played and statistics are available.
          </p>
        </CardContent>
      </Card>
    )
  }

  const compareTeamData = compareTeam ? data.allTeams.find((t) => t.teamNumber === compareTeam) : null

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Team Comparison
          </h2>
          <p className="text-muted-foreground">
            Compare performance with {data.eventStats.totalTeams} teams at this event
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchComparison}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <p className="text-xs text-muted-foreground">Updated: {lastUpdate.toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Event Overview */}
      <Card className="border" style={{ backgroundColor: 'var(--color-background-secondary)', borderColor: 'var(--color-border)' }}>
        <CardContent className="p-6">
          <h3 className="font-semibold mb-4">Event Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{data.eventStats.totalTeams}</div>
              <div className="text-sm text-muted-foreground">Total Teams</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{data.eventStats.avgOPR.toFixed(1)}</div>
              <div className="text-sm text-muted-foreground">Avg OPR</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{data.eventStats.avgScore.toFixed(0)}</div>
              <div className="text-sm text-muted-foreground">Avg Score</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{data.eventStats.highestScore}</div>
              <div className="text-sm text-muted-foreground">High Score</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={teamNumber ? "your-performance" : "leaderboards"} className="space-y-4">
        <TabsList className={`grid w-full ${teamNumber ? "grid-cols-4" : "grid-cols-3"}`}>
          {teamNumber && (
            <TabsTrigger value="your-performance" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              Your Performance
            </TabsTrigger>
          )}
          <TabsTrigger value="leaderboards" className="flex items-center gap-2">
            <Medal className="h-4 w-4" />
            Leaderboards
          </TabsTrigger>
          <TabsTrigger value="similar-teams" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Similar Teams
          </TabsTrigger>
          <TabsTrigger value="all-teams" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            All Teams
          </TabsTrigger>
        </TabsList>

        {teamNumber && data.targetTeam && data.percentiles && (
          <TabsContent value="your-performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Your Performance Percentiles
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <PercentileCard
                    title="Overall Rank"
                    value={`#${data.targetTeam.rank}`}
                    percentile={data.percentiles.rank}
                    icon={Trophy}
                  />
                  <PercentileCard
                    title="OPR"
                    value={data.targetTeam.opr.toFixed(1)}
                    percentile={data.percentiles.opr}
                    icon={TrendingUp}
                  />
                  <PercentileCard
                    title="DPR"
                    value={data.targetTeam.dpr.toFixed(1)}
                    percentile={data.percentiles.dpr}
                    icon={Shield}
                  />
                  <PercentileCard
                    title="Win Rate"
                    value={`${data.targetTeam.winRate.toFixed(0)}%`}
                    percentile={data.percentiles.winRate}
                    icon={Target}
                  />
                  <PercentileCard
                    title="Avg Score"
                    value={data.targetTeam.avgScore.toFixed(0)}
                    percentile={data.percentiles.avgScore}
                    icon={Zap}
                  />
                  <PercentileCard
                    title="Avg Margin"
                    value={`${data.targetTeam.avgMargin >= 0 ? "+" : ""}${data.targetTeam.avgMargin.toFixed(0)}`}
                    percentile={data.percentiles.avgMargin}
                    icon={BarChart3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Head-to-Head Comparison */}
            {compareTeamData && (
              <Card>
                <CardHeader>
                  <CardTitle>Head-to-Head Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    <TeamCard team={data.targetTeam} highlight={true} />
                    <TeamCard team={compareTeamData} />
                  </div>
                  <Button variant="outline" onClick={() => setCompareTeam(null)} className="mt-4 w-full">
                    Clear Comparison
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        <TabsContent value="leaderboards" className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <TopPerformersList teams={data.topPerformers.opr} metric="opr" title="🔥 Highest OPR" />
            <TopPerformersList teams={data.topPerformers.dpr} metric="dpr" title="🛡️ Best Defense (Lowest DPR)" />
            <TopPerformersList teams={data.topPerformers.winRate} metric="winRate" title="🏆 Best Win Rate" />
            <TopPerformersList teams={data.topPerformers.avgScore} metric="avgScore" title="⚡ Highest Avg Score" />
            <TopPerformersList
              teams={data.topPerformers.highScore}
              metric="highScore"
              title="🎯 Highest Single Score"
            />
          </div>
        </TabsContent>

        <TabsContent value="similar-teams" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Teams with Similar Rankings
                {teamNumber && data.targetTeam && <Badge variant="outline">Near Rank #{data.targetTeam.rank}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.similarTeams.map((team) => (
                  <TeamCard key={team.teamNumber} team={team} showComparison={true} />
                ))}
                {data.similarTeams.length === 0 && (
                  <p className="text-center text-muted-foreground py-4 col-span-full">No similar teams found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all-teams" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                All Teams at Event
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Input
                  placeholder="Search by team number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {filteredTeams.map((team) => (
                  <TeamCard key={team.teamNumber} team={team} showComparison={true} />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
