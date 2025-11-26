"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  TrendingUp,
  Shield,
  Calculator,
  RefreshCw,
  AlertTriangle,
  Info,
  Trophy,
  BarChart3,
} from "lucide-react"

interface TeamOPR {
  teamNumber: number
  opr: number
  dpr: number
  matchesPlayed: number
}

interface OPRInsightsProps {
  eventCode: string
  teamNumber?: number
}

interface OPRData {
  opr: TeamOPR[]
  matchesProcessed: number
  teamsAnalyzed: number
  calculationMethod: string
  lastUpdated: string
}

export function OPRInsights({ eventCode, teamNumber }: OPRInsightsProps) {
  const [data, setData] = useState<OPRData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchOPRData = async () => {
    try {
      setError(null)
      console.log("Fetching OPR data for event:", eventCode)

      const response = await fetch(`/api/events/${eventCode}/opr`)
      const result = await response.json()

      if (response.ok) {
        setData(result)
        setLastUpdate(new Date())
        console.log(`Loaded OPR data for ${result.teamsAnalyzed} teams`)
      } else {
        setError("Unable to calculate OPR data")
      }
    } catch (error) {
      console.error("Error fetching OPR data:", error)
      setError("Failed to load OPR data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOPRData()

    // Refresh every 3 minutes
    const interval = setInterval(fetchOPRData, 180000)
    return () => clearInterval(interval)
  }, [eventCode])

  const getTeamOPR = (teamNum: number): TeamOPR | null => {
    return data?.opr.find((team) => team.teamNumber === teamNum) || null
  }

  const targetTeam = teamNumber ? getTeamOPR(teamNumber) : null

  const topOPRTeams =
    data?.opr
      .slice()
      .sort((a, b) => b.opr - a.opr)
      .slice(0, 10) || []
  const topDPRTeams =
    data?.opr
      .slice()
      .sort((a, b) => a.dpr - b.dpr)
      .slice(0, 10) || []

  const TeamOPRCard = ({ team, rank, metric }: { team: TeamOPR; rank: number; metric: "opr" | "dpr" }) => {
    const isTarget = team.teamNumber === teamNumber
    const value = team[metric]
    const displayValue = metric === "dpr" ? value.toFixed(1) : value.toFixed(1)

    return (
      <div
        className={`flex items-center justify-between p-3 rounded-lg border ${isTarget ? "border-purple-500 bg-white dark:bg-black dark:border-purple-300" : "border-gray-200 hover:border-gray-300"
          }`}
      >
        <div className="flex items-center gap-3">
          <Badge variant={rank <= 3 ? "default" : "outline"}>#{rank}</Badge>
          <div>
            <div className={`font-semibold ${isTarget ? "text-purple-500 dark:text-purple-300" : ""}`}>Team {team.teamNumber}</div>
            <div className="text-sm text-muted-foreground">{team.matchesPlayed} matches</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">{displayValue}</div>
          <div className="text-xs text-muted-foreground">{metric.toUpperCase()}</div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 dark:border-purple-300 mx-auto mb-4"></div>
        <p>Calculating OPR statistics...</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-4" />
          <p className="text-yellow-900 dark:text-yellow-100">{error}</p>
          <Button variant="outline" onClick={fetchOPRData} className="mt-4">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.opr.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No OPR Data Available</h3>
          <p className="text-muted-foreground">
            OPR calculations will appear here once sufficient match data is available.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            OPR Analysis
          </h2>
          <p className="text-muted-foreground">
            Advanced statistics calculated using matrix algebra • {data.teamsAnalyzed} teams analyzed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchOPRData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground">Updated: {lastUpdate.toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Calculation Info */}
      <Card className="bg-white dark:bg-black border-blue-200 dark:border-blue-800">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm ">
              <p className="font-semibold mb-1">Custom OPR Calculation:</p>
              <p>
                Using matrix algebra to solve team contributions from {data.matchesProcessed} completed matches. OPR =
                offensive contribution, DPR = defensive impact.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Target Team Stats */}
      {targetTeam && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Your Team's OPR Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-3xl font-bold text-green-600">{targetTeam.opr.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Offensive Power Rating</div>
                <div className="text-xs text-muted-foreground mt-1">Points contributed per match</div>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <Shield className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-3xl font-bold text-blue-600">{targetTeam.dpr.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Defensive Power Rating</div>
                <div className="text-xs text-muted-foreground mt-1">Opponent points allowed</div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Badge variant="outline">Based on {targetTeam.matchesPlayed} matches</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="opr" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="opr" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Top OPR
          </TabsTrigger>
          <TabsTrigger value="dpr" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Best Defense
          </TabsTrigger>
        </TabsList>

        <TabsContent value="opr" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Highest Offensive Power Rating
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topOPRTeams.map((team, index) => (
                  <TeamOPRCard key={team.teamNumber} team={team} rank={index + 1} metric="opr" />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dpr" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Best Defensive Performance (Lowest DPR)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topDPRTeams.map((team, index) => (
                  <TeamOPRCard key={team.teamNumber} team={team} rank={index + 1} metric="dpr" />
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Statistics Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Event Statistics Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{data.teamsAnalyzed}</div>
              <div className="text-sm text-muted-foreground">Teams Analyzed</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{data.matchesProcessed}</div>
              <div className="text-sm text-muted-foreground">Matches Processed</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {data.opr.length > 0 ? (data.opr.reduce((sum, t) => sum + t.opr, 0) / data.opr.length).toFixed(1) : "0"}
              </div>
              <div className="text-sm text-muted-foreground">Average OPR</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {data.opr.length > 0 ? Math.max(...data.opr.map((t) => t.opr)).toFixed(1) : "0"}
              </div>
              <div className="text-sm text-muted-foreground">Highest OPR</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
