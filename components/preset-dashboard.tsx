"use client"

import { useState, useEffect } from "react"
import { OPRModule, OPRSmallModule } from "@/components/modules/opr-module"
import { PerformanceModule } from "./modules/performance-module"
import { RankingsModule } from "./modules/rankings-module"
import { AllianceModule } from "./modules/alliance-module"
import { EventOverviewModule } from "./modules/event-overview-module"
import { RankModule, WinRateModule, AverageScoreModule } from "./modules/performance-percentile-module"
import { TeamStats, Ranking, Alliance } from "@/app/dashboard/[eventCode]/[teamNumber]/page"
import { ComparisonData } from "./team-comparison"

interface PresetDashboardProps {
  eventCode: string
  teamNumber: number
  ranking: Ranking
  rankings: Ranking[]
  teamStats: TeamStats
  alliance: Alliance
  layout?: 'compact' | 'detailed' | 'rankings' | 'overview'
}

export function PresetDashboard({
  eventCode,
  teamNumber,
  ranking,
  rankings,
  teamStats,
  alliance,
  layout = 'overview'
}: PresetDashboardProps) {
  const [data, setData] = useState<ComparisonData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
    const interval = setInterval(fetchComparison, 240000)
    return () => clearInterval(interval)
  }, [eventCode, teamNumber])

  // Compact View - Everything visible, smaller modules
  if (layout === 'compact') {
    return (
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-3">
          <PerformanceModule teamRanking={ranking} teamStats={teamStats} />
        </div>
        <div className="col-span-3">
          <EventOverviewModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
        </div>
        <div className="col-span-3">
          <AllianceModule alliance={alliance} teamNumber={teamNumber} />
        </div>
        <div className="col-span-3">
          <OPRSmallModule
            opr={data?.targetTeam?.opr}
            dpr={data?.targetTeam?.dpr}
            ccwm={data?.targetTeam?.ccwm}
            matchesPlayed={data?.targetTeam?.played}
            loading={loading}
            error={error}
          />
        </div>
        <div className="col-span-4">
          <RankModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
        </div>
        <div className="col-span-4">
          <WinRateModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
        </div>
        <div className="col-span-4">
          <AverageScoreModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
        </div>
        <div className="col-span-12">
          <RankingsModule rankings={rankings} teamNumber={teamNumber} />
        </div>
      </div>
    )
  }

  // Detailed View - Larger modules with more breathing room
  if (layout === 'detailed') {
    return (
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-4">
          <PerformanceModule teamRanking={ranking} teamStats={teamStats} />
        </div>
        <div className="col-span-4">
          <EventOverviewModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
        </div>
        <div className="col-span-4">
          <AllianceModule alliance={alliance} teamNumber={teamNumber} />
        </div>
        <div className="col-span-12">
          <OPRModule
            opr={data?.targetTeam?.opr}
            dpr={data?.targetTeam?.dpr}
            ccwm={data?.targetTeam?.ccwm}
            matchesPlayed={data?.targetTeam?.played}
            loading={loading}
            error={error}
          />
        </div>
        <div className="col-span-4">
          <RankModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
        </div>
        <div className="col-span-4">
          <WinRateModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
        </div>
        <div className="col-span-4">
          <AverageScoreModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
        </div>
        <div className="col-span-12">
          <RankingsModule rankings={rankings} teamNumber={teamNumber} />
        </div>
      </div>
    )
  }

  // Rankings Focus - Emphasizes rankings and competitive stats
  if (layout === 'rankings') {
    return (
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-5">
          <RankingsModule rankings={rankings} teamNumber={teamNumber} />
        </div>
        <div className="col-span-7">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <PerformanceModule teamRanking={ranking} teamStats={teamStats} />
            <AllianceModule alliance={alliance} teamNumber={teamNumber} />
          </div>
          <OPRModule
            opr={data?.targetTeam?.opr}
            dpr={data?.targetTeam?.dpr}
            ccwm={data?.targetTeam?.ccwm}
            matchesPlayed={data?.targetTeam?.played}
            loading={loading}
            error={error}
          />
          <div className="grid grid-cols-3 gap-4 mt-4">
            <RankModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
            <WinRateModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
            <AverageScoreModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
          </div>
        </div>
      </div>
    )
  }

  // Overview (Default) - Balanced layout
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-4">
        <RankingsModule rankings={rankings} teamNumber={teamNumber} />
      </div>
      <div className="col-span-4">
        <PerformanceModule teamRanking={ranking} teamStats={teamStats} />
        <div className="mt-4">
          <EventOverviewModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
        </div>
      </div>
      <div className="col-span-4">
        <AllianceModule alliance={alliance} teamNumber={teamNumber} />
        <div className="mt-4">
          <OPRSmallModule
            opr={data?.targetTeam?.opr}
            dpr={data?.targetTeam?.dpr}
            ccwm={data?.targetTeam?.ccwm}
            matchesPlayed={data?.targetTeam?.played}
            loading={loading}
            error={error}
          />
        </div>
      </div>
      <div className="col-span-4">
        <RankModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
      </div>
      <div className="col-span-4">
        <WinRateModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
      </div>
      <div className="col-span-4">
        <AverageScoreModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
      </div>
    </div>
  )
}
