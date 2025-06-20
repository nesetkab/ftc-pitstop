"use client"

import { useState, useEffect } from "react"
import { Responsive, WidthProvider, Layout } from "react-grid-layout"
import { OPRModule, OPRSmallModule } from "@/components/modules/opr-module"
import { PerformanceModule } from "./modules/performance-module"
import { RankingsModule } from "./modules/rankings-module"
import { AllianceModule } from "./modules/alliance-module"
import { EventOverviewModule } from "./modules/event-overview-module"
import { RankModule, WinRateModule, AverageScoreModule } from "./modules/performance-percentile-module"
import { TeamStats, Ranking, Alliance } from "@/app/dashboard/[eventCode]/[teamNumber]/page"
import { ComparisonData } from "./team-comparison"
import 'react-grid-layout/css/styles.css'

interface ModularDashboardProps {
  eventCode: string,
  teamNumber: number,
  ranking: Ranking,
  rankings: Ranking[],
  teamStats: TeamStats,
  alliance: Alliance
}

export function ModularDashboard({ eventCode, teamNumber, ranking, rankings, teamStats, alliance }: ModularDashboardProps) {
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
    const interval = setInterval(fetchComparison, 240000)
    return () => clearInterval(interval)
  }, [eventCode, teamNumber])

  const layout = loadLayout()

  const ResponsiveGridLayout = WidthProvider(Responsive)

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={{ lg: layout }}
      cols={{ lg: 12 }}
      rowHeight={30}
      isBounded={true}
      containerPadding={[0, 0]}
      onLayoutChange={saveLayout}
    >
      <div key="a">
        <PerformanceModule teamRanking={ranking} teamStats={teamStats} />
      </div>
      <div key="b">
        <RankingsModule rankings={rankings} teamNumber={teamNumber} />
      </div>
      <div key="c">
        <OPRModule eventCode={eventCode} teamNumber={teamNumber} />
      </div>
      <div key="d">
        <AllianceModule alliance={alliance} teamNumber={teamNumber} />
      </div>
      <div key="e">
        <OPRSmallModule eventCode={eventCode} teamNumber={teamNumber} />
      </div>
      <div key="f">
        <EventOverviewModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
      </div>
      <div key="g">
        <RankModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
      </div>
      <div key="h">
        <WinRateModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
      </div>
      <div key="j">
        <AverageScoreModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
      </div>

    </ResponsiveGridLayout >
  );
}

const defaultLayout = [
  { i: "a", x: 4, y: 0, w: 4, h: 8 },
  { i: "b", x: 0, y: 0, w: 4, h: 24 },
  { i: "c", x: 4, y: 6, w: 8, h: 8 },
  { i: "d", x: 8, y: 6, w: 4, h: 8 },
  { i: "e", x: 4, y: 12, w: 4, h: 8 },
  { i: "f", x: 8, y: 0, w: 4, h: 8 },
  { i: "g", x: 0, y: 12, w: 4, h: 5 },
  { i: "h", x: 4, y: 12, w: 4, h: 5 },
  { i: "j", x: 8, y: 12, w: 4, h: 5 }
]

const saveLayout = (layout: Layout) => {
  setClientSideCookie('layout', JSON.stringify(layout))
}

const loadLayout = () => {
  const cookie = getClientSideCookie('layout')
  if (!cookie) return defaultLayout
  return JSON.parse(cookie)
}

const getClientSideCookie = (name: string): string | undefined => {
  const cookieValue = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1];

  return cookieValue;
};

const setClientSideCookie = (name: string, value: string) => {
  document.cookie = name + "=" + value
}
