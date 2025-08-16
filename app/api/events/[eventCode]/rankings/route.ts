import { type NextRequest, NextResponse } from "next/server"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventCode: string }> }
) {
  const { eventCode } = await params
  const season = process.env.FTC_SEASON
  const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

  try {
    const teamNumberParam = request.nextUrl.searchParams.get("teamNumber")
    const response = await fetch(
      `${FTC_API_BASE}/${season}/rankings/${eventCode.toUpperCase()}`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Rankings API Error:", errorText)
      return NextResponse.json({ rankings: [] })
    }

    const data = await response.json()
    let rankings = data.rankings || []

    // If teamNumber provided, filter for that team
    if (teamNumberParam) {
      const teamNumber = parseInt(teamNumberParam, 10)
      rankings = rankings.filter((r: any) => r.teamNumber === teamNumber)
    }

    return NextResponse.json({ rankings })
  } catch (error) {
    console.error("Error fetching rankings:", error)
    return NextResponse.json({ rankings: [] })
  }
}
