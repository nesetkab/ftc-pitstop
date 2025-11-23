import { type NextRequest, NextResponse } from "next/server"
import { calculateOPRForMatches } from "@/lib/opr-calculator"
import { ftcApiClient } from "@/lib/ftc-api-client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params
  const bypassCache = request.nextUrl.searchParams.get("bypassCache") === "true"

  try {
    console.log("Calculating OPR for event:", eventCode)

    // Fetch all matches through cache layer
    const { data, fromCache } = await ftcApiClient.getMatches(eventCode.toUpperCase(), { bypassCache })
    const matches = data.matches || []

    console.log(`Processing ${matches.length} matches for OPR calculation (fromCache: ${fromCache})`)

    // Transform matches to our format
    const transformedMatches = matches
      .filter(
        (match: any) =>
          match.scoreRedFinal !== null && match.scoreBlueFinal !== null && match.teams && match.teams.length === 4,
      )
      .map((match: any) => ({
        matchNumber: match.matchNumber,
        red1: match.teams?.find((t: any) => t.station === "Red1")?.teamNumber || 0,
        red2: match.teams?.find((t: any) => t.station === "Red2")?.teamNumber || 0,
        blue1: match.teams?.find((t: any) => t.station === "Blue1")?.teamNumber || 0,
        blue2: match.teams?.find((t: any) => t.station === "Blue2")?.teamNumber || 0,
        redScore: match.scoreRedFinal || 0,
        blueScore: match.scoreBlueFinal || 0,
        redFoul: match.scoreRedFoul || 0,
        blueFoul: match.scoreBlueFoul || 0,
        played: true,
      }))

    console.log(`Transformed ${transformedMatches.length} valid matches for OPR calculation`)

    if (transformedMatches.length === 0) {
      console.log("No valid matches found for OPR calculation")
      return NextResponse.json({
        opr: [],
        message: "No completed matches available for OPR calculation",
        matchesProcessed: 0,
      })
    }

    // Calculate OPR using our custom algorithm
    const oprData = calculateOPRForMatches(transformedMatches)

    console.log(`Calculated OPR for ${oprData.length} teams`)

    // Add some metadata
    const result = {
      opr: oprData,
      matchesProcessed: transformedMatches.length,
      teamsAnalyzed: oprData.length,
      calculationMethod: "custom_matrix_algebra",
      lastUpdated: new Date().toISOString(),
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error calculating OPR:", error)
    return NextResponse.json(
      {
        opr: [],
        error: "Failed to calculate OPR",
        details: error instanceof Error ? error.message : "Unknown error",
        matchesProcessed: 0,
        teamsAnalyzed: 0,
      },
      { status: 500 },
    )
  }
}
