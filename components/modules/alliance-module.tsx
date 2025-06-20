import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alliance } from "@/app/dashboard/[eventCode]/[teamNumber]/page"
import { AllianceCard } from "@/components/alliance-card"
import { Users } from "lucide-react"

export function AllianceModule({ alliance, teamNumber }: { alliance: Alliance, teamNumber: number }) {
  if (!alliance) {
    return (
      <Card className="flex flex-col h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Alliance
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-full justify-center items-center">
          If you join an alliance, it will appear here.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Your Alliance
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col h-full">
        <AllianceCard alliance={alliance} teamNumber={teamNumber} />
      </CardContent>
    </Card>
  )
}
