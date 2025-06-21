'use client'
import { Card, CardContent } from "@/components/ui/card"
import { PercentileCard } from "../percentile-card"
import { ComparisonData } from "../team-comparison"
import { Trophy, AlertTriangle, BarChart3 } from "lucide-react"

export function RankModule({ data, teamNumber, error, loading }: { data: ComparisonData | null, teamNumber: number, error: string | null, loading: boolean }) {
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
        </CardContent>
      </Card>
    )
  }

  if (!data || data.allTeams.length === 0 || !data.targetTeam || !data.percentiles) {
    return (
      <Card className="h-full flex flex-col justify-center">
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
    <div className="grid grid-cols-1 grid-rows-1 h-full">
      <PercentileCard
        title="Overall Rank"
        value={`#${data.targetTeam.rank}`}
        percentile={data.percentiles.rank}
        icon={Trophy}
      />

    </div>
  )
}

export function WinRateModule({ data, teamNumber, error, loading }: { data: ComparisonData | null, teamNumber: number, error: string | null, loading: boolean }) {
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
        </CardContent>
      </Card>
    )
  }

  if (!data || data.allTeams.length === 0 || !data.targetTeam || !data.percentiles) {
    return (
      <Card className="h-full flex flex-col justify-center">
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
    <div className="grid grid-cols-1 grid-rows-1 h-full">
      <PercentileCard
        title="Win Rate"
        value={`${data.targetTeam.winRate.toFixed(0)}%`}
        percentile={data.percentiles.winRate}
        icon={Trophy}
      />

    </div>
  )
}

export function AverageScoreModule({ data, teamNumber, error, loading }: { data: ComparisonData | null, teamNumber: number, error: string | null, loading: boolean }) {
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
        </CardContent>
      </Card>
    )
  }

  if (!data || data.allTeams.length === 0 || !data.targetTeam || !data.percentiles) {
    return (
      <Card className="h-full flex flex-col justify-center">
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
    <div className="grid grid-cols-1 grid-rows-1 h-full">
      <PercentileCard
        title="Average Score"
        value={data.targetTeam.avgScore.toFixed(0)}
        percentile={data.percentiles.avgScore}
        icon={Trophy}
      />

    </div>
  )
}
