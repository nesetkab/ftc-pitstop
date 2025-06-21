"use client"

import { useRouter } from "next/navigation"
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
import { Button, Text, Dialog, Switch } from "@radix-ui/themes"

interface ModularDashboardPropsimport {
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

    // Refresh every 4 minutes
    const interval = setInterval(fetchComparison, 240000)
    return () => clearInterval(interval)
  }, [eventCode, teamNumber])

  const layout = loadLayout()
  const modules = loadEnabledModules()

  const ResponsiveGridLayout = WidthProvider(Responsive)

  console.log(data)

  return (
    <div className="flex flex-col justify-center w-full h-full">
      <ResponsiveGridLayout
        className="layout"
        breakpoints={{ xxs: 0, sm: 768 }}
        layouts={{ xxs: layout, sm: layout }}
        cols={{ xxs: 1, sm: 12 }}
        rowHeight={30}
        isBounded={true}
        containerPadding={[0, 0]}
        onLayoutChange={saveLayout}
      >
        {modules.includes("Performance") && (<div key="Performance">
          <PerformanceModule teamRanking={ranking} teamStats={teamStats} />
        </div>)}
        {modules.includes("Rankings") && (<div key="Rankings">
          <RankingsModule rankings={rankings} teamNumber={teamNumber} />
        </div>)}
        {modules.includes("OPR") && (<div key="OPR">
          <OPRModule opr={data?.targetTeam?.opr} dpr={data?.targetTeam?.dpr} ccwm={data?.targetTeam?.ccwm} matchesPlayed={data?.targetTeam?.played} loading={loading} error={error} />
        </div>)}
        {modules.includes("Alliance") && (<div key="Alliance">
          <AllianceModule alliance={alliance} teamNumber={teamNumber} />
        </div>)}
        {modules.includes("OPR (Small)") && (<div key="OPR (Small)">
          <OPRSmallModule opr={data?.targetTeam?.opr} dpr={data?.targetTeam?.dpr} ccwm={data?.targetTeam?.ccwm} matchesPlayed={data?.targetTeam?.played} loading={loading} error={error} />
        </div>)}
        {modules.includes("Event Overview") && (<div key="Event Overview">
          <EventOverviewModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
        </div>)}
        {modules.includes("Rank Percentile") && (<div key="Rank Percentile">
          <RankModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
        </div>)}
        {modules.includes("Win Rate") && (<div key="Win Rate">
          <WinRateModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
        </div>)}
        {modules.includes("Average Score") && (<div key="Average Score">
          <AverageScoreModule data={data} teamNumber={teamNumber} error={error} loading={loading} />
        </div>)}

      </ResponsiveGridLayout >
      <ModuleSelectionDialog modules={modules} />
    </div>
  );
}

const defaultLayout = [
  { i: "Performance", x: 4, y: 0, w: 4, h: 8 },
  { i: "Rankings", x: 0, y: 0, w: 4, h: 24 },
  { i: "OPR", x: 4, y: 6, w: 8, h: 8 },
  { i: "Alliance", x: 8, y: 6, w: 4, h: 8 },
  { i: "OPR (Small)", x: 4, y: 12, w: 4, h: 8 },
  { i: "Event Overview", x: 8, y: 0, w: 4, h: 8 },
  { i: "Rank Percentile", x: 0, y: 12, w: 4, h: 5 },
  { i: "Win Rate", x: 4, y: 12, w: 4, h: 5 },
  { i: "Average Score", x: 8, y: 12, w: 4, h: 5 }
]

const defaultModules = [ // this is used as the list of all modules
  "Performance",
  "Rankings",
  "OPR",
  "Alliance",
  "OPR (Small)",
  "Event Overview",
  "Rank Percentile",
  "Win Rate",
  "Average Score",
]


const ModuleSelectionDialog = ({ modules }: { modules: string[] }) => {
  const router = useRouter()

  return (<Dialog.Root>
    <Dialog.Trigger>
      <div className="flex justify-center pt-6">
        <Button variant="soft" color="gray" size="4" highContrast>Edit</Button>
      </div>
    </Dialog.Trigger>
    <Dialog.Content size="4">
      <Dialog.Title>Select Modules</Dialog.Title>
      <Text as="p" trim="both" size="4">
        Choose which modules to show on the dashboard. Don't forget to hit save when you are done.
      </Text>
      <div className="mt-6 grid grid-cols-2 gap-4 grid-flow-row">
        {
          defaultModules.map(module => (
            <label key={module} className="flex items-center gap-2">
              <Switch
                key={module}
                defaultChecked={modules.includes(module)}
                onCheckedChange={(checked) => {
                  if (!checked) { modules = modules.filter(m => m != module) }
                  else { modules.push(module) }
                }}></Switch>
              {module}
            </label>
          ))
        }
      </div>
      <div className="pt-4 flex justify-end">
        <Dialog.Close>
          <Button size="4" color="gray" variant="soft" highContrast onClick={() => { saveEnabledModules(modules); router.refresh() }}>Save</Button>
        </Dialog.Close>
      </div>
    </Dialog.Content>
  </Dialog.Root>)
};



const saveLayout = (layout: Layout) => {
  setClientSideCookie('layout', JSON.stringify(layout))
}

const loadLayout = () => {
  const cookie = getClientSideCookie('layout')
  if (!cookie) return defaultLayout
  return JSON.parse(cookie)
}

const saveEnabledModules = (modules: string[]) => {
  console.log(modules)
  setClientSideCookie('enabledModules', JSON.stringify(modules))
}

const loadEnabledModules = () => {
  const cookie = getClientSideCookie('enabledModules')
  if (!cookie) return defaultModules
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
