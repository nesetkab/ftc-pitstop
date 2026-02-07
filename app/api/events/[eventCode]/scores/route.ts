import { type NextRequest, NextResponse } from "next/server"
import { ftcApiClient } from "@/lib/ftc-api-client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params
  const searchParams = request.nextUrl.searchParams
  const matchNumber = searchParams.get("match")
  const level = searchParams.get("level") || "qual"
  const bypassCache = searchParams.get("bypassCache") === "true"

  try {
    const { data, fromCache } = await ftcApiClient.getScoreDetails(
      eventCode.toUpperCase(),
      level,
      { bypassCache }
    )

    const scores = data.matchScores || data.MatchScores || []

    // Log the raw data keys for debugging score field names
    if (scores.length > 0 && scores[0]?.alliances?.length > 0) {
      console.log("Score alliance fields:", Object.keys(scores[0].alliances[0]))
    }

    // If a specific match number is requested, filter to just that match
    if (matchNumber) {
      const matchNum = parseInt(matchNumber, 10)
      const matchScore = scores.find((s: any) => s.matchNumber === matchNum)

      return NextResponse.json({
        score: matchScore || null,
        _meta: { fromCache, timestamp: new Date().toISOString() }
      })
    }

    return NextResponse.json({
      scores,
      _meta: { fromCache, timestamp: new Date().toISOString() }
    })
  } catch (error) {
    console.error("Error fetching scores:", error)
    return NextResponse.json(
      { error: "Failed to fetch score details", scores: [] },
      { status: 500 }
    )
  }
}
