"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  TrendingUp,
  Shield,
  Calculator,
  RefreshCw,
  AlertTriangle,
  Trophy,
} from "lucide-react"

interface TeamOPR {
  teamNumber: number
  opr: number
  dpr: number
  matchesPlayed: number
}

interface OPRInsightsProps {
  eventCode: string
  teamNumber?: number
}

interface OPRData {
  opr: TeamOPR[]
  matchesProcessed: number
  teamsAnalyzed: number
  calculationMethod: string
  lastUpdated: string
}

export function OPRModule({ opr, dpr, autoOpr, teleopOpr, endgameOpr, matchesPlayed, loading, error }: { opr: number | undefined, dpr: number | undefined, autoOpr?: number, teleopOpr?: number, endgameOpr?: number, matchesPlayed: number | undefined, loading: boolean, error: string | null }) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 dark:border-purple-300 mx-auto mb-4"></div>
        <p>Calculating OPR statistics...</p>
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

  if (!opr) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No OPR Data Available</h3>
          <p className="text-muted-foreground">
            OPR calculations will appear here once sufficient match data is available.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 h-full">
      {/* Target Team Stats */}
      {opr && (
        <Card className="h-full flex flex-col">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                Your Team's OPR Statistics
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col h-full">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg flex flex-col justify-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <div className="text-3xl font-bold mb-2 text-green-600">{opr.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">Total OPR</div>
                <div className="text-xs text-muted-foreground mt-1">Overall contribution</div>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg flex flex-col justify-center">
                <Shield className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <div className="text-3xl font-bold mb-2 text-blue-600">{dpr ? dpr.toFixed(1) : 'N/A'}</div>
                <div className="text-sm text-muted-foreground">DPR</div>
                <div className="text-xs text-muted-foreground mt-1">Opponent points</div>
              </div>
            </div>

            {/* Detailed OPR Breakdown */}
            {(autoOpr !== undefined || teleopOpr !== undefined || endgameOpr !== undefined) && (
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <div className="text-2xl font-bold mb-1 text-purple-600">{autoOpr?.toFixed(1) || 'N/A'}</div>
                  <div className="text-xs text-muted-foreground">Auto OPR</div>
                </div>
                <div className="text-center p-3 bg-indigo-50 dark:bg-indigo-950 rounded-lg">
                  <div className="text-2xl font-bold mb-1 text-indigo-600">{teleopOpr?.toFixed(1) || 'N/A'}</div>
                  <div className="text-xs text-muted-foreground">TeleOp OPR</div>
                </div>
                <div className="text-center p-3 bg-cyan-50 dark:bg-cyan-950 rounded-lg">
                  <div className="text-2xl font-bold mb-1 text-cyan-600">{endgameOpr?.toFixed(1) || 'N/A'}</div>
                  <div className="text-xs text-muted-foreground">Endgame OPR</div>
                </div>
              </div>
            )}

            <div className="mt-4 text-center">
              <Badge variant="outline">Based on {matchesPlayed ?? 0} matches</Badge>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}

export function OPRSmallModule({ opr, dpr, matchesPlayed, loading, error }: { opr: number | undefined, dpr: number | undefined, matchesPlayed: number | undefined, loading: boolean, error: string | null }) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 dark:border-purple-300 mx-auto mb-4"></div>
        <p>Calculating OPR statistics...</p>
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

  if (!opr) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No OPR Data Available</h3>
          <p className="text-muted-foreground">
            OPR calculations will appear here once sufficient match data is available.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 h-full">
      {/* Target Team Stats */}
      {opr && (
        <Card className="h-full flex flex-col">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                OPR Stats
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="h-full flex flex-col">
            <div className="grid md:grid-cols-2 gap-4 h-full">
              <div className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="flex">
                  <TrendingUp className="h-8 w-8 mr-2 text-green-600" />
                  <div className="text-2xl font-bold text-green-600">{opr.toFixed(1)}</div>
                </div>
                <div className="text-sm text-green-600">OPR</div>
              </div>
              <div className="flex justify-between items-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="flex">
                  <Shield className="h-8 w-8 mr-2 text-blue-600" />
                  <div className="text-2xl font-bold text-blue-600">{dpr ? dpr.toFixed(1) : 'N/A'}</div>
                </div>
                <div className="text-sm text-blue-600">DPR</div>
              </div>
            </div>
            <div className="mt-4 text-center">
              <Badge variant="outline">Based on {matchesPlayed ?? 0} matches</Badge>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  )
}
