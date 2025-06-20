'use client'
import { Responsive, WidthProvider, } from "react-grid-layout"
import { OPRModule, OPRSmallModule } from "@/components/modules/opr-module"
import { PerformanceModule } from "./modules/performance-module"
import { RankingsModule } from "./modules/rankings-module"
import { AllianceModule } from "./modules/alliance-module"
import { EventOverviewModule } from "./modules/event-overview-module"
import { TeamStats, Ranking, Alliance } from "@/app/dashboard/[eventCode]/[teamNumber]/page"
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
  const layout = [
    { i: "a", x: 4, y: 0, w: 4, h: 8 },
    { i: "b", x: 0, y: 0, w: 4, h: 24 },
    { i: "c", x: 4, y: 6, w: 8, h: 8 },
    { i: "d", x: 8, y: 6, w: 4, h: 8 },
    { i: "e", x: 4, y: 12, w: 4, h: 8 },
    { i: "f", x: 8, y: 0, w: 4, h: 8 }
  ]

  const ResponsiveGridLayout = WidthProvider(Responsive)

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={{ lg: layout }}
      cols={{ lg: 12 }}
      rowHeight={30}
      isBounded={true}
      containerPadding={[0, 0]}
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
        <EventOverviewModule eventCode={eventCode} teamNumber={teamNumber} />
      </div>
    </ResponsiveGridLayout >
  );
}
