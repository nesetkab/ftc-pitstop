"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  TrendingUp,
  Shield,
  Target,
  Calculator,
  RefreshCw,
  AlertTriangle,
  Info,
  Trophy,
  BarChart3,
  Zap,
} from "lucide-react"

interface TeamOPR {
  teamNumber: number
  opr: number
  dpr: number
  ccwm: number
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

export function OPRModule({ eventCode, teamNumber }: OPRInsightsProps) {
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
      {/* Target Team Stats */}
      {targetTeam && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Your Team's OPR Statistics
              </CardTitle>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Updated: {lastUpdate.toLocaleTimeString()}</p>
                <Button variant="outline" size="sm" onClick={fetchOPRData}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
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
              <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <Target className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                <div className="text-3xl font-bold text-purple-600">{targetTeam.ccwm.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">CCWM</div>
                <div className="text-xs text-muted-foreground mt-1">Contribution to winning margin</div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Badge variant="outline">Based on {targetTeam.matchesPlayed} matches</Badge>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}

export function OPRSmallModule({ eventCode, teamNumber }: OPRInsightsProps) {
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
      {/* Target Team Stats */}
      {targetTeam && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                OPR Stats
              </CardTitle>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">Updated: {lastUpdate.toLocaleTimeString()}</p>
                <Button variant="outline" size="sm" onClick={fetchOPRData}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex justify-between col-span-2 items-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="flex">
                  <TrendingUp className="h-8 w-8 mr-2 text-green-600" />
                  <div className="text-2xl font-bold text-green-600">{targetTeam.opr.toFixed(1)}</div>
                </div>
                <div className="text-sm text-green-600">OPR</div>
              </div>
              <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="flex">
                  <Shield className="h-8 w-8 mr-2 text-blue-600" />
                  <div className="text-2xl font-bold text-blue-600">{targetTeam.dpr.toFixed(1)}</div>
                </div>
                <div className="text-sm text-blue-600">DPR</div>
              </div>
              <div className="flex justify-between items-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                <div className="flex">
                  <TrendingUp className="h-8 w-8 mr-2 text-purple-600" />
                  <div className="text-2xl font-bold text-purple-600">{targetTeam.ccwm.toFixed(1)}</div>
                </div>
                <div className="text-sm text-purple-600">CCWM</div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Badge variant="outline">Based on {targetTeam.matchesPlayed} matches</Badge>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
