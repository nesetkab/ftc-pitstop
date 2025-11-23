import { type NextRequest, NextResponse } from "next/server"
import { ftcApiClient } from "@/lib/ftc-api-client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params
  const bypassCache = request.nextUrl.searchParams.get("bypassCache") === "true"

  try {
    console.log("Fetching teams for event:", eventCode)

    // Get teams through cache layer
    const { data, fromCache } = await ftcApiClient.getTeams(eventCode.toUpperCase(), { bypassCache })

    console.log("Teams data:", {
      teamCount: data.teams?.length || 0,
      fromCache,
    })

    return NextResponse.json({
      teams: data.teams || [],
      _meta: {
        fromCache,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Error fetching teams:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch teams",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
