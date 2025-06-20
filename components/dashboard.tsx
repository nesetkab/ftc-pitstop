'use client'
import { Responsive, WidthProvider, } from "react-grid-layout"
import { OPRModule, OPRSmallModule } from "@/components/modules/opr-module"
import { PerformanceModule } from "./modules/performance-module"
import { TeamStats, Ranking } from "@/app/dashboard/[eventCode]/[teamNumber]/page"
import 'react-grid-layout/css/styles.css'

interface ModularDashboardProps {
  eventCode: string,
  teamNumber: number,
  ranking: Ranking,
  teamStats: TeamStats
}

export function ModularDashboard({ eventCode, teamNumber, ranking, teamStats }: ModularDashboardProps) {
  const layout = [
    { i: "a", x: 0, y: 0, w: 4, h: 8 },
    { i: "b", x: 7, y: 0, w: 6, h: 8 },
    { i: "c", x: 0, y: 0, w: 6, h: 8 },
    { i: "d", x: 6, y: 0, w: 4, h: 8 },
    { i: "e", x: 0, y: 0, w: 4, h: 8 },
    { i: "f", x: 0, y: 0, w: 4, h: 8 },
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
        <OPRModule eventCode={eventCode} teamNumber={teamNumber} />
      </div>
      <div key="c">
        <OPRModule eventCode={eventCode} teamNumber={teamNumber} />
      </div>
      <div key="d">
        <OPRSmallModule eventCode={eventCode} teamNumber={teamNumber} />
      </div>
      <div key="e">
        <OPRSmallModule eventCode={eventCode} teamNumber={teamNumber} />
      </div>
      <div key="f">
        <OPRSmallModule eventCode={eventCode} teamNumber={teamNumber} />
      </div>
    </ResponsiveGridLayout >
  );
}
