import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alliance } from "@/app/dashboard/[eventCode]/[teamNumber]/page"
import { Badge } from "@/components/ui/badge"

export const AllianceCard = ({ alliance, teamNumber }: { alliance: Alliance, teamNumber: number }) => {
  const isTeamInAlliance =
    alliance.captain === teamNumber ||
    alliance.round1 === teamNumber ||
    alliance.round2 === teamNumber ||
    alliance.backup === teamNumber

  return (
    <Card className={isTeamInAlliance ? "border-purple-500 dark:border-purple-300 bg-white dark:bg-black h-full" : "h-full"}>
      <CardContent className="p-4 flex flex-col h-full justify-center">
        <div className="text-center">
          <Badge variant="outline" className="mb-3">
            Alliance {alliance.number}
          </Badge>
          <div className="space-y-2">
            <div className={`font-bold ${alliance.captain === teamNumber ? "text-purple-600 dark:text-purple-400 font-bold" : ""}`}>
              <div className="text-xs text-muted-foreground">Captain</div>
              <div>{alliance.captain}{alliance.captainDisplay}</div>
            </div>
            <div className={`${alliance.round1 === teamNumber ? "text-purple-600 dark:text-purple-400 font-bold" : ""}`}>
              <div className="text-xs text-muted-foreground">Pick 1</div>
              <div>{alliance.round1}</div>
            </div>
            {alliance.round2 && (<div className={`${alliance.round2 === teamNumber ? "text-purple-600 dark:text-purple-400 font-bold" : ""}`}>
              <div className="text-xs text-muted-foreground">Pick 2</div>
              <div>{alliance.round2}</div>
            </div>
            )}
            {alliance.backup && (
              <div className={`${alliance.backup === teamNumber ? "text-purple-600 dark:text-purple-400 font-bold" : ""}`}>
                <div className="text-xs text-muted-foreground">Backup</div>
                <div>{alliance.backup}</div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
