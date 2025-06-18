import { type NextRequest, NextResponse } from "next/server"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventCode: string }> }
) {
  const { eventCode } = await params

  try {
    const season = 2024
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

    console.log("Fetching rankings for event:", eventCode)

    // Make sure we're using the correct URL format
    const response = await fetch(`https://ftc-api.firstinspires.org/v2.0/${season}/rankings/${eventCode.toUpperCase()}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    })

    console.log("Rankings API Response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Rankings API Error:", errorText)
      throw new Error(`Rankings API failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    // Log the full response structure for debugging
    // console.log("Full rankings response:", JSON.stringify(data, null, 2))

    // Make sure we're accessing the correct property
    const rankings = data.Rankings || []

    // Transform rankings to match our expected format
    const transformedRankings = rankings.map((ranking: any) => ({
      rank: ranking.rank,
      team: ranking.teamNumber,
      rp: ranking.rankingPoints || 0,
      tbp: ranking.tieBreakerPoints || 0,
      wins: ranking.wins || 0,
      losses: ranking.losses || 0,
      ties: ranking.ties || 0,
      matches: (ranking.wins || 0) + (ranking.losses || 0) + (ranking.ties || 0),
      qualifyingPoints: ranking.qualifyingPoints || 0,
    }))

    console.log(`Transformed ${transformedRankings.length} rankings`)

    return NextResponse.json({ rankings: transformedRankings })
  } catch (error) {
    console.error("Error fetching rankings:", error)
    return NextResponse.json({ rankings: [] })
  }
}
