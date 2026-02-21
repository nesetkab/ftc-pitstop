import { type NextRequest, NextResponse } from "next/server"
import { ftcApiClient } from "@/lib/ftc-api-client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params
  const searchParams = request.nextUrl.searchParams
  const teamNumber = searchParams.get("team")
  const bypassCache = searchParams.get("bypassCache") === "true"

  try {
    console.log("Fetching matches for event:", eventCode, "team:", teamNumber)

    const upperEventCode = eventCode.toUpperCase()
    const fetchOptions = { bypassCache }

    // Fetch both match results and schedule in parallel
    // The matches endpoint only returns played matches
    // The schedule endpoint returns all scheduled matches (including unplayed)
    const [resultsResponse, qualScheduleResponse, playoffScheduleResponse] = await Promise.all([
      ftcApiClient.getMatches(upperEventCode, fetchOptions),
      ftcApiClient.getSchedule(upperEventCode, 'qual', fetchOptions).catch(() => ({ data: { matches: [] as any[] }, fromCache: false })),
      ftcApiClient.getSchedule(upperEventCode, 'playoff', fetchOptions).catch(() => ({ data: { matches: [] as any[] }, fromCache: false })),
    ])

    const results = resultsResponse.data.matches || []
    const qualScheduleData = qualScheduleResponse.data as any
    const playoffScheduleData = playoffScheduleResponse.data as any
    const schedule = [
      ...(qualScheduleData.schedule || qualScheduleData.matches || []),
      ...(playoffScheduleData.schedule || playoffScheduleData.matches || []),
    ]

    console.log("Results count:", results.length, "Schedule count:", schedule.length)

    // Build a set of played match keys for quick lookup
    const playedMatchKeys = new Set(
      results.map((m: any) => `${m.tournamentLevel}-${m.series}-${m.matchNumber}`)
    )

    // Merge: use results for played matches, schedule for unplayed
    // Start with all results (played matches)
    const mergedMap = new Map<string, any>()

    for (const match of results) {
      const key = `${match.tournamentLevel}-${match.series}-${match.matchNumber}`
      mergedMap.set(key, { ...match, _played: true })
    }

    // Add scheduled matches that don't have results yet
    for (const match of schedule) {
      const key = `${match.tournamentLevel}-${match.series}-${match.matchNumber}`
      if (!mergedMap.has(key)) {
        mergedMap.set(key, { ...match, _played: false })
      }
    }

    let matches = Array.from(mergedMap.values())

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
      startTime: match.actualStartTime || match.postResultTime || match.startTime || match.scheduledStartTime,
      red1: match.teams?.find((t: any) => t.station === "Red1")?.teamNumber || 0,
      red2: match.teams?.find((t: any) => t.station === "Red2")?.teamNumber || 0,
      blue1: match.teams?.find((t: any) => t.station === "Blue1")?.teamNumber || 0,
      blue2: match.teams?.find((t: any) => t.station === "Blue2")?.teamNumber || 0,
      redScore: match.scoreRedFinal ?? match.scoreRed ?? 0,
      blueScore: match.scoreBlueFinal ?? match.scoreBlue ?? 0,
      redFoul: match.scoreRedFoul ?? 0,
      blueFoul: match.scoreBlueFoul ?? 0,
      played: match._played,
      tournamentLevel: match.tournamentLevel || "Qualification",
      series: match.series,
      matchInSeries: match.matchInSeries,
    }))

    // Sort by tournament level then match number
    transformedMatches.sort((a: any, b: any) => {
      const levelOrder: Record<string, number> = { "Qualification": 0, "Semifinal": 1, "Final": 2 }
      const levelDiff = (levelOrder[a.tournamentLevel] ?? 0) - (levelOrder[b.tournamentLevel] ?? 0)
      if (levelDiff !== 0) return levelDiff
      return a.matchNumber - b.matchNumber
    })

    const playedCount = transformedMatches.filter((m: any) => m.played).length
    const upcomingCount = transformedMatches.filter((m: any) => !m.played).length
    console.log("Total matches:", transformedMatches.length, "played:", playedCount, "upcoming:", upcomingCount)

    return NextResponse.json({
      matches: transformedMatches,
      _meta: {
        fromCache: resultsResponse.fromCache,
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
