import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

const getPercentileColor = (percentile: number) => {
  if (percentile >= 80) return "text-green-600"
  if (percentile >= 60) return "text-blue-600"
  if (percentile >= 40) return "text-yellow-600"
  return "text-red-600"
}

const getPercentileDescription = (percentile: number) => {
  if (percentile >= 90) return "Excellent"
  if (percentile >= 75) return "Very Good"
  if (percentile >= 60) return "Good"
  if (percentile >= 40) return "Average"
  if (percentile >= 25) return "Below Average"
  return "Needs Improvement"
}

export const PercentileCard = ({
  title,
  value,
  percentile,
  icon: Icon,
}: {
  title: string
  value: string
  percentile: number
  icon: any
}) => (
  <Card className="h-full">
    <CardContent className="p-4 h-full">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <Badge variant="outline" className={getPercentileColor(percentile)}>
          {percentile}%
        </Badge>
      </div>
      <div className="flex flex-col justify-center h-full">
        <div className="text-2xl font-bold mb-2">{value}</div>
        <div className="space-y-1">
          <Progress value={percentile} className="h-2" />
          <div className={`text-xs ${getPercentileColor(percentile)}`}>{getPercentileDescription(percentile)}</div>
        </div>
      </div>
    </CardContent>
  </Card>
)
