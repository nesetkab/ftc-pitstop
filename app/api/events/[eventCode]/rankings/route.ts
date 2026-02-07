import { type NextRequest, NextResponse } from "next/server"
import { ftcApiClient } from "@/lib/ftc-api-client"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventCode: string }> }
) {
  const { eventCode } = await params
  const teamNumberParam = request.nextUrl.searchParams.get("teamNumber")
  const bypassCache = request.nextUrl.searchParams.get("bypassCache") === "true"

  try {
    // Fetch rankings through cache layer
    const { data, fromCache } = await ftcApiClient.getRankings(
      eventCode.toUpperCase(),
      { bypassCache }
    )

    let rankings = (data.rankings || []).map((r: any) => ({
      ...r,
      // Map FTC API sortOrder fields to RP/TBP
      rp: r.sortOrder1 ?? r.rankingPoints ?? r.rp ?? 0,
      tbp: r.sortOrder2 ?? r.tieBreakerPoints ?? r.tbp ?? 0,
      team: r.teamNumber,
      teamName: r.teamName || undefined,
    }))

    // If teamNumber provided, filter for that team
    if (teamNumberParam) {
      const teamNumber = parseInt(teamNumberParam, 10)
      rankings = rankings.filter((r: any) => r.teamNumber === teamNumber)
    }

    return NextResponse.json({
      rankings,
      _meta: {
        fromCache,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Error fetching rankings:", error)
    return NextResponse.json(
      {
        rankings: [],
        error: error instanceof Error ? error.message : "Failed to fetch rankings"
      },
      { status: 500 }
    )
  }
}
