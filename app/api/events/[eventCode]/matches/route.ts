import { type NextRequest, NextResponse } from "next/server"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params
  const searchParams = request.nextUrl.searchParams
  const teamNumber = searchParams.get("team")

  try {
    const season = 2024
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

    console.log("Fetching matches for event:", eventCode, "team:", teamNumber)

    // The correct endpoint for matches is /matches/{eventCode}
    let url = `${FTC_API_BASE}/${season}/matches/${eventCode.toUpperCase()}`
    if (teamNumber) {
      url += `?teamNumber=${teamNumber}`
    }

    console.log("Fetching from URL:", url)

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    })

    console.log("Matches API Response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Matches API Error:", errorText)

      // If the specific endpoint fails, try getting all matches without team filter
      if (teamNumber) {
        console.log("Retrying without team filter...")
        const retryUrl = `${FTC_API_BASE}/${season}/matches/${eventCode.toUpperCase()}`
        const retryResponse = await fetch(retryUrl, {
          headers: {
            Authorization: `Basic ${auth}`,
            Accept: "application/json",
          },
        })

        if (retryResponse.ok) {
          const retryData = await retryResponse.json()
          console.log("Retry successful, filtering matches locally")

          // Filter matches locally for the specific team
          const allMatches = retryData.matches || []
          const teamMatches = allMatches.filter((match: any) =>
            match.teams?.some((team: any) => team.teamNumber === Number.parseInt(teamNumber)),
          )

          const transformedMatches = teamMatches.map((match: any) => ({
            matchNumber: match.matchNumber,
            description: match.description || `Match ${match.matchNumber}`,
            startTime: match.actualStartTime || match.postResultTime || match.scheduledStartTime,
            red1: match.teams?.find((t: any) => t.station === "Red1")?.teamNumber || 0,
            red2: match.teams?.find((t: any) => t.station === "Red2")?.teamNumber || 0,
            blue1: match.teams?.find((t: any) => t.station === "Blue1")?.teamNumber || 0,
            blue2: match.teams?.find((t: any) => t.station === "Blue2")?.teamNumber || 0,
            redScore: match.scoreRedFinal ?? match.scoreRed ?? 0,
            blueScore: match.scoreBlueFinal ?? match.scoreBlue ?? 0,
            played: match.scoreRedFinal !== null && match.scoreBlueFinal !== null,
            tournamentLevel: match.tournamentLevel || "Qualification",
            series: match.series,
            matchInSeries: match.matchInSeries,
          }))

          return NextResponse.json({ matches: transformedMatches })
        }
      }

      throw new Error(`API responded with status: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("Matches data structure:", {
      hasMatches: !!data.matches,
      matchCount: data.matches?.length || 0,
      dataKeys: Object.keys(data),
    })

    // Transform the matches to match our expected format
    const transformedMatches =
      data.matches?.map((match: any) => ({
        matchNumber: match.matchNumber,
        description: match.description || `Match ${match.matchNumber}`,
        startTime: match.actualStartTime || match.postResultTime || match.scheduledStartTime,
        red1: match.teams?.find((t: any) => t.station === "Red1")?.teamNumber || 0,
        red2: match.teams?.find((t: any) => t.station === "Red2")?.teamNumber || 0,
        blue1: match.teams?.find((t: any) => t.station === "Blue1")?.teamNumber || 0,
        blue2: match.teams?.find((t: any) => t.station === "Blue2")?.teamNumber || 0,
        redScore: match.scoreRedFinal ?? match.scoreRed ?? 0,
        blueScore: match.scoreBlueFinal ?? match.scoreBlue ?? 0,
        played: match.scoreRedFinal !== null && match.scoreBlueFinal !== null,
        tournamentLevel: match.tournamentLevel || "Qualification",
        series: match.series,
        matchInSeries: match.matchInSeries,
      })) || []

    console.log("Transformed matches count:", transformedMatches.length)
    return NextResponse.json({ matches: transformedMatches })
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
