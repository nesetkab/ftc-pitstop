import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Trophy
} from "lucide-react"
import { Ranking, TeamStats } from "@/app/dashboard/[eventCode]/[teamNumber]/page"

export function PerformanceModule({ teamRanking, teamStats }: { teamRanking: Ranking | null, teamStats: TeamStats | null }) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" />
          Performance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 flex flex-col h-full justify-center pt-2">
        {teamRanking && (
          <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded border border-blue-200 dark:border-blue-900">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">#{teamRanking.rank}</div>
            <div className="text-[10px] text-muted-foreground">Current Rank</div>
          </div>
        )}

        {teamStats && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-xl font-bold text-green-600">{teamStats.wins}</div>
                <div className="text-[10px] text-muted-foreground">Wins</div>
              </div>
              <div>
                <div className="text-xl font-bold text-red-600">{teamStats.losses}</div>
                <div className="text-[10px] text-muted-foreground">Losses</div>
              </div>
              <div>
                <div className="text-xl font-bold text-yellow-600">{teamStats.ties}</div>
                <div className="text-[10px] text-muted-foreground">Ties</div>
              </div>
            </div>

            {(teamStats.opr > 0 || teamStats.dpr > 0) && (
              <div className="space-y-1 pt-2 border-t border-border/50">
                <div className="flex justify-between items-center">
                  <span className="text-xs">OPR</span>
                  <span className="font-semibold text-sm">{teamStats.opr.toFixed(1)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs">DPR</span>
                  <span className="font-semibold text-sm">{teamStats.dpr.toFixed(1)}</span>
                </div>
              </div>
            )}
          </>
        )}

        {!teamStats && (
          <div className="text-center text-muted-foreground py-4">
            <p className="text-xs">Statistics will appear here once matches begin.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
