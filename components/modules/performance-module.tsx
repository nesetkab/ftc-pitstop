import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Trophy
} from "lucide-react"
import { Ranking, TeamStats } from "@/app/dashboard/[eventCode]/[teamNumber]/page"

export function PerformanceModule({ teamRanking, teamStats }: { teamRanking: Ranking, teamStats: TeamStats }) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 flex flex-col h-full justify-center">
        {teamRanking && (
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">#{teamRanking.rank}</div>
            <div className="text-sm text-muted-foreground">Current Rank</div>
          </div>
        )}

        {teamStats && (
          <>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-600">{teamStats.wins}</div>
                <div className="text-xs text-muted-foreground">Wins</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{teamStats.losses}</div>
                <div className="text-xs text-muted-foreground">Losses</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{teamStats.ties}</div>
                <div className="text-xs text-muted-foreground">Ties</div>
              </div>
            </div>

            {(teamStats.opr > 0 || teamStats.dpr > 0 || teamStats.ccwm > 0) && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">OPR</span>
                  <span className="font-semibold">{teamStats.opr.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">DPR</span>
                  <span className="font-semibold">{teamStats.dpr.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">CCWM</span>
                  <span className="font-semibold">{teamStats.ccwm.toFixed(1)}</span>
                </div>
              </div>
            )}
          </>
        )}

        {!teamStats && (
          <div className="text-center text-muted-foreground py-4">
            <p>Statistics will appear here once matches begin.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
