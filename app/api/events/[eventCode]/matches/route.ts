import { type NextRequest, NextResponse } from "next/server"
import { ftcApiClient } from "@/lib/ftc-api-client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params
  const searchParams = request.nextUrl.searchParams
  const teamNumber = searchParams.get("team")
  const bypassCache = searchParams.get("bypassCache") === "true"

  try {
    console.log("Fetching matches for event:", eventCode, "team:", teamNumber)

    // Fetch matches through cache layer
    const { data, fromCache } = await ftcApiClient.getMatches(
      eventCode.toUpperCase(),
      { bypassCache }
    )

    console.log("Matches data structure:", {
      hasMatches: !!data.matches,
      matchCount: data.matches?.length || 0,
      fromCache,
    })

    let matches = data.matches || []

    // Filter matches for specific team if requested
    if (teamNumber) {
      matches = matches.filter((match: any) =>
        match.teams?.some((team: any) => team.teamNumber === Number.parseInt(teamNumber))
      )
      console.log(`Filtered to ${matches.length} matches for team ${teamNumber}`)
    }

    // Transform the matches to match our expected format
    const transformedMatches = matches.map((match: any) => ({
      matchNumber: match.matchNumber,
      description: match.description || `Match ${match.matchNumber}`,
      startTime: match.actualStartTime || match.postResultTime || match.scheduledStartTime,
      red1: match.teams?.find((t: any) => t.station === "Red1")?.teamNumber || 0,
      red2: match.teams?.find((t: any) => t.station === "Red2")?.teamNumber || 0,
      blue1: match.teams?.find((t: any) => t.station === "Blue1")?.teamNumber || 0,
      blue2: match.teams?.find((t: any) => t.station === "Blue2")?.teamNumber || 0,
      redScore: match.scoreRedFinal ?? match.scoreRed ?? 0,
      blueScore: match.scoreBlueFinal ?? match.scoreBlue ?? 0,
      redFoul: match.scoreRedFoul ?? 0,
      blueFoul: match.scoreBlueFoul ?? 0,
      played: match.scoreRedFinal !== null && match.scoreBlueFinal !== null,
      tournamentLevel: match.tournamentLevel || "Qualification",
      series: match.series,
      matchInSeries: match.matchInSeries,
    }))

    console.log("Transformed matches count:", transformedMatches.length)

    return NextResponse.json({
      matches: transformedMatches,
      _meta: {
        fromCache,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Error fetching matches:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch matches",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
