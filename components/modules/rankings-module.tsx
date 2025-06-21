import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  TrendingUp
} from "lucide-react"
import { Ranking } from "@/app/dashboard/[eventCode]/[teamNumber]/page"

export function RankingsModule({ rankings, teamNumber }: { rankings: Ranking[], teamNumber: number }) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Rankings
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col h-full overflow-y-scroll">
        <div className="space-y-2 flex flex-col">
          {rankings.slice(0, rankings.length).map((ranking, index) => (
            <div
              key={ranking.teamNumber}
              className={`flex items-center justify-between p-2 rounded ${ranking.team === teamNumber ? "bg-blue-100 dark:bg-blue-900" : ""
                }`}
            >
              <div className="flex items-center gap-2">
                <Badge variant={ranking.teamNumber === teamNumber ? "win" : index < 3 ? "default" : "secondary"} >#{ranking.rank}</Badge>
                <span className={ranking.teamNumber === teamNumber ? "font-bold" : ""}>{ranking.teamNumber} - {ranking.teamName}</span>

              </div>
              <div className="text-sm text-muted-foreground">
                {ranking.wins}-{ranking.losses}-{ranking.ties}
              </div>
            </div>
          ))}
          {rankings.length === 0 && (
            <p className="text-center text-muted-foreground py-4">
              Rankings will appear here during the event.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
