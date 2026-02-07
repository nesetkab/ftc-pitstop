"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, Trophy, Calculator } from "lucide-react"

interface DetailedOPRModuleProps {
  opr: number | undefined
  dpr: number | undefined
  autoOpr?: number
  teleopOpr?: number
  endgameOpr?: number
  matchesPlayed: number | undefined
  loading: boolean
  error: string | null
  oprRank?: number
  totalTeams?: number
}

export function DetailedOPRModule({
  opr,
  dpr,
  autoOpr,
  teleopOpr,
  endgameOpr,
  matchesPlayed,
  loading,
  error,
  oprRank,
  totalTeams
}: DetailedOPRModuleProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto mb-2"></div>
          <p className="text-sm">Loading OPR statistics...</p>
        </CardContent>
      </Card>
    )
  }

  if (error || opr === undefined || opr === null) {
    return (
      <Card>
        <CardContent className="p-4 text-center">
          <Calculator className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <h3 className="text-base font-semibold mb-1">No OPR Data Available</h3>
          <p className="text-muted-foreground text-xs">
            {error || "OPR calculations will appear once sufficient match data is available."}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          Team Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-2">
        {/* OPR Ranking */}
        {oprRank && totalTeams && (
          <div className="mb-3 p-2 bg-purple-50 dark:bg-purple-950/30 rounded text-start border border-purple-200 dark:border-purple-900">
            <div className="text-xs text-muted-foreground">OPR Ranking</div>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
              {oprRank} / {totalTeams}
            </div>
            <div className="text-[10px] text-muted-foreground">teams at event</div>
          </div>
        )}

        {/* Total OPR */}
        <div className="mb-2 pb-2 border-b border-border/50">
          <div className="flex items-center justify-between ">
            <span className="text-xs font-medium flex items-center gap-1.5">
              Total OPR
            </span>
            <span className="text-xl font-bold text-green-600">{opr.toFixed(2)}</span>
          </div>

        </div>

        {/* Auto OPR */}
        <div className="mb-2 pb-2 border-b border-border/50">
          <div className="flex items-center justify-between ">
            <span className="text-xs font-medium">Auto OPR</span>
            <span className="text-lg font-bold text-orange-600">
              {autoOpr !== undefined && autoOpr !== 0 ? autoOpr.toFixed(2) : 'N/A'}
            </span>
          </div>
        </div>

        {/* TeleOp OPR */}
        <div className="mb-2 pb-2 border-b border-border/50">
          <div className="flex items-center justify-between ">
            <span className="text-xs font-medium">TeleOp OPR</span>
            <span className="text-lg font-bold text-indigo-600">
              {teleopOpr !== undefined && teleopOpr !== 0 ? teleopOpr.toFixed(2) : 'N/A'}
            </span>
          </div>

        </div>

        {/* Endgame OPR */}
        <div className="mb-2 pb-2 border-b border-border/50">
          <div className="flex items-center justify-between ">
            <span className="text-xs font-medium">Endgame OPR</span>
            <span className="text-lg font-bold text-cyan-600">
              {endgameOpr !== undefined && endgameOpr !== 0 ? endgameOpr.toFixed(2) : 'N/A'}
            </span>
          </div>

        </div>

        {/* DPR */}
        {dpr !== undefined && (
          <div className="mb-2 pb-2 border-b border-border/50">
            <div className="flex items-center justify-between ">
              <span className="text-xs font-medium">Defensive Rating (DPR)</span>
              <span className="text-lg font-bold text-blue-600">{dpr.toFixed(2)}</span>
            </div>

          </div>
        )}

        {/* Matches Played */}
        <div className="mt-2 text-center">
          <Badge variant="outline" className="text-[10px] py-0 px-2">Based on {matchesPlayed ?? 0} matches</Badge>
        </div>
      </CardContent>
    </Card>
  )
}
