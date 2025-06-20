
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  RefreshCw,
  AlertTriangle,
  BarChart3,
  Clipboard
} from "lucide-react"
import { ComparisonData } from "../team-comparison"

export function EventOverviewModule({ eventCode, teamNumber }: { eventCode: string, teamNumber: number }) {
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
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

  return (
    <Card className="bg-slate-300 border-black dark:bg-black dark:border-gray-500 h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clipboard className="h-5 w-5" />
          Event Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 h-full flex flex-col justify-center">
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
  )
}
