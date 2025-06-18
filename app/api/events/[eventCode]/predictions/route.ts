import { type NextRequest, NextResponse } from "next/server"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params
  const searchParams = request.nextUrl.searchParams
  const teamNumber = searchParams.get("team")

  try {
    const season = 2024
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

    console.log("Fetching prediction data for event:", eventCode)

    // Get matches and our custom OPR data
    const [matchesResponse, oprResponse] = await Promise.all([
      fetch(
        `${FTC_API_BASE}/${season}/matches/${eventCode.toUpperCase()}${teamNumber ? `?teamNumber=${teamNumber}` : ""}`,
        {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: "application/json",
          },
        },
      ),
      // Use our custom OPR calculation
      fetch(`${request.nextUrl.origin}/api/events/${eventCode}/opr`),
    ])

    let matches = []
    let oprData = []

    if (matchesResponse.ok) {
      const matchesResult = await matchesResponse.json()
      matches = matchesResult.matches || []
    }

    if (oprResponse.ok) {
      const oprResult = await oprResponse.json()
      oprData = oprResult.opr || []
    } else {
      console.log("Custom OPR calculation failed, using fallback prediction method")
    }

    // Create OPR lookup map
    const oprMap = new Map()
    oprData.forEach((team: any) => {
      oprMap.set(team.teamNumber, {
        opr: team.opr || 0,
        dpr: team.dpr || 0,
        ccwm: team.ccwm || 0,
      })
    })

    // Calculate predictions for unplayed matches
    const predictions = matches
      .filter((match: any) => !match.played && match.scoreRedFinal === null && match.scoreBlueFinal === null)
      .map((match: any) => {
        const red1Stats = oprMap.get(match.teams?.find((t: any) => t.station === "Red1")?.teamNumber) || {
          opr: 0,
          dpr: 0,
          ccwm: 0,
        }
        const red2Stats = oprMap.get(match.teams?.find((t: any) => t.station === "Red2")?.teamNumber) || {
          opr: 0,
          dpr: 0,
          ccwm: 0,
        }
        const blue1Stats = oprMap.get(match.teams?.find((t: any) => t.station === "Blue1")?.teamNumber) || {
          opr: 0,
          dpr: 0,
          ccwm: 0,
        }
        const blue2Stats = oprMap.get(match.teams?.find((t: any) => t.station === "Blue2")?.teamNumber) || {
          opr: 0,
          dpr: 0,
          ccwm: 0,
        }

        // Calculate alliance strengths using our custom OPR
        const redOPR = red1Stats.opr + red2Stats.opr
        const redDPR = red1Stats.dpr + red2Stats.dpr
        const blueOPR = blue1Stats.opr + blue2Stats.opr
        const blueDPR = blue1Stats.dpr + blue2Stats.dpr

        // Predicted scores (OPR - opponent's DPR)
        const predictedRedScore = Math.max(0, redOPR - blueDPR)
        const predictedBlueScore = Math.max(0, blueOPR - redDPR)

        // Win probability based on score difference and uncertainty
        const scoreDiff = predictedRedScore - predictedBlueScore
        const uncertainty = 15 // Standard deviation for match uncertainty
        const redWinProb = 0.5 + scoreDiff / (2 * uncertainty)
        const clampedRedWinProb = Math.max(0.05, Math.min(0.95, redWinProb))

        // Determine confidence based on data availability
        let confidence = "low"
        if (oprData.length > 0) {
          const hasAllTeamData = [red1Stats, red2Stats, blue1Stats, blue2Stats].every(
            (stats) => stats.opr > 0 || stats.dpr > 0,
          )
          if (hasAllTeamData) {
            confidence = "high"
          } else {
            confidence = "medium"
          }
        }

        return {
          matchNumber: match.matchNumber,
          description: match.description,
          startTime: match.actualStartTime || match.scheduledStartTime,
          red1: match.teams?.find((t: any) => t.station === "Red1")?.teamNumber || 0,
          red2: match.teams?.find((t: any) => t.station === "Red2")?.teamNumber || 0,
          blue1: match.teams?.find((t: any) => t.station === "Blue1")?.teamNumber || 0,
          blue2: match.teams?.find((t: any) => t.station === "Blue2")?.teamNumber || 0,
          predictedRedScore: Math.round(predictedRedScore),
          predictedBlueScore: Math.round(predictedBlueScore),
          redWinProbability: Math.round(clampedRedWinProb * 100),
          blueWinProbability: Math.round((1 - clampedRedWinProb) * 100),
          confidence,
          tournamentLevel: match.tournamentLevel || "Qualification",
        }
      })

    console.log(`Generated ${predictions.length} match predictions using custom OPR`)
    return NextResponse.json({
      predictions,
      oprCalculation: {
        method: "custom_matrix_algebra",
        teamsAnalyzed: oprData.length,
        dataQuality: oprData.length > 0 ? "good" : "limited",
      },
    })
  } catch (error) {
    console.error("Error generating predictions:", error)
    return NextResponse.json({
      predictions: [],
      oprCalculation: { method: "failed", teamsAnalyzed: 0, dataQuality: "none" },
    })
  }
}
