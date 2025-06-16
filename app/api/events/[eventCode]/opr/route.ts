import { type NextRequest, NextResponse } from "next/server"
import { calculateOPRForMatches } from "@/lib/opr-calculator"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params

  try {
    const season = 2024
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

    console.log("Calculating OPR for event:", eventCode)

    // Fetch all matches for the event
    const response = await fetch(`${FTC_API_BASE}/${season}/matches/${eventCode.toUpperCase()}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Matches API Error:", errorText)
      throw new Error(`Failed to fetch matches: ${response.status}`)
    }

    const data = await response.json()
    const matches = data.matches || []

    console.log(`Processing ${matches.length} matches for OPR calculation`)

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
