import { type NextRequest, NextResponse } from "next/server"
import { calculateOPRForMatches } from "@/lib/opr-calculator"
import { ftcApiClient } from "@/lib/ftc-api-client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params
  const bypassCache = request.nextUrl.searchParams.get("bypassCache") === "true"

  try {
    console.log("Calculating OPR for event:", eventCode)

    // Fetch all matches and score details through cache layer
    let matchesResult, scoreDetailsResult
    try {
      [matchesResult, scoreDetailsResult] = await Promise.all([
        ftcApiClient.getMatches(eventCode.toUpperCase(), { bypassCache }),
        ftcApiClient.getScoreDetails(eventCode.toUpperCase(), 'qual', { bypassCache })
      ])
    } catch (error) {
      console.error("Error fetching data:", error)
      // If score details fail, continue with just matches
      matchesResult = await ftcApiClient.getMatches(eventCode.toUpperCase(), { bypassCache })
      scoreDetailsResult = { data: { MatchScores: [] }, fromCache: false }
      console.log("Continuing without score details")
    }

    const matches = matchesResult.data.matches || []
    const scoreDetails = scoreDetailsResult.data.matchScores || scoreDetailsResult.data.MatchScores || []

    console.log(`Processing ${matches.length} matches for OPR calculation (fromCache: ${matchesResult.fromCache})`)
    console.log(`Got ${scoreDetails.length} score details (fromCache: ${scoreDetailsResult.fromCache})`)

    // Debug: Log raw score details response structure
    console.log('Score details response keys:', Object.keys(scoreDetailsResult.data))
    if (scoreDetails.length > 0) {
      console.log('First score detail keys:', Object.keys(scoreDetails[0]))
      console.log('First score detail sample:', JSON.stringify(scoreDetails[0], null, 2))
    }

    // Create a map of match numbers to their score details
    const scoreDetailMap = new Map()
    scoreDetails.forEach((detail: any) => {
      scoreDetailMap.set(detail.matchNumber, detail)
    })

    // Transform matches to our format - ONLY QUALIFICATION MATCHES for OPR
    const transformedMatches = matches
      .filter(
        (match: any) =>
          match.scoreRedFinal !== null &&
          match.scoreBlueFinal !== null &&
          match.teams &&
          match.teams.length === 4 &&
          match.tournamentLevel === "QUALIFICATION",
      )
      .map((match: any) => {
        const detail = scoreDetailMap.get(match.matchNumber)

        // Extract teleopBasePoints from the alliances array
        const redAlliance = detail?.alliances?.find((a: any) => a.alliance === "Red")
        const blueAlliance = detail?.alliances?.find((a: any) => a.alliance === "Blue")

        return {
          matchNumber: match.matchNumber,
          red1: match.teams?.find((t: any) => t.station === "Red1")?.teamNumber || 0,
          red2: match.teams?.find((t: any) => t.station === "Red2")?.teamNumber || 0,
          blue1: match.teams?.find((t: any) => t.station === "Blue1")?.teamNumber || 0,
          blue2: match.teams?.find((t: any) => t.station === "Blue2")?.teamNumber || 0,
          redScore: match.scoreRedFinal || 0,
          blueScore: match.scoreBlueFinal || 0,
          redFoul: match.scoreRedFoul || 0,
          blueFoul: match.scoreBlueFoul || 0,
          redAuto: match.scoreRedAuto ?? 0,
          blueAuto: match.scoreBlueAuto ?? 0,
          redEndgame: redAlliance?.teleopBasePoints ?? 0,
          blueEndgame: blueAlliance?.teleopBasePoints ?? 0,
          played: true,
        }
      })

    console.log(`Transformed ${transformedMatches.length} valid matches for OPR calculation`)

    // Debug: Check if endgame (teleopBasePoints) data is available
    if (transformedMatches.length > 0) {
      const sampleMatch = transformedMatches[0]
      console.log('Sample match endgame values:', {
        redEndgame: sampleMatch.redEndgame,
        blueEndgame: sampleMatch.blueEndgame
      })
    }

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
