import { type NextRequest, NextResponse } from "next/server"
import { ftcApiClient } from "@/lib/ftc-api-client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamNumber: string; eventCode: string }> }) {
  const { teamNumber, eventCode } = await params
  const bypassCache = request.nextUrl.searchParams.get("bypassCache") === "true"

  try {
    console.log("Fetching stats for team:", teamNumber, "at event:", eventCode)

    // Fetch matches, OPR, and rankings through cache layer
    const [matchesResult, oprResponse, rankingsResult] = await Promise.all([
      ftcApiClient.getMatches(eventCode.toUpperCase(), { bypassCache }),
      // Use our custom OPR calculation (which now uses cache)
      fetch(`${request.nextUrl.origin}/api/events/${eventCode}/opr${bypassCache ? '?bypassCache=true' : ''}`),
      ftcApiClient.getRankings(eventCode.toUpperCase(), { bypassCache }),
    ])

    // Filter matches for this specific team
    const allMatches = matchesResult.data.matches || []
    const matches = allMatches.filter((match: any) =>
      match.teams?.some((team: any) => team.teamNumber === Number.parseInt(teamNumber))
    )

    console.log(`Found ${matches.length} matches for team (fromCache: ${matchesResult.fromCache})`)

    // Calculate W/L/T from matches
    let wins = 0,
      losses = 0,
      ties = 0

    matches.forEach((match: any) => {
      if (match.scoreRedFinal === null || match.scoreBlueFinal === null) return // Not played

      const teamStation = match.teams?.find((t: any) => t.teamNumber === Number.parseInt(teamNumber))
      if (!teamStation) return

      const isRed = teamStation.station.includes("Red")
      const redScore = match.scoreRedFinal || 0
      const blueScore = match.scoreBlueFinal || 0

      if (isRed) {
        if (redScore > blueScore) wins++
        else if (redScore < blueScore) losses++
        else ties++
      } else {
        if (blueScore > redScore) wins++
        else if (blueScore < redScore) losses++
        else ties++
      }
    })

    // Get OPR data from our custom calculation
    let opr = 0,
      dpr = 0,
      autoOpr = 0,
      teleopOpr = 0,
      endgameOpr = 0

    if (oprResponse.ok) {
      const oprData = await oprResponse.json()
      const teamOpr = oprData.opr?.find((o: any) => o.teamNumber === Number.parseInt(teamNumber))
      if (teamOpr) {
        opr = teamOpr.opr || 0
        dpr = teamOpr.dpr || 0
        autoOpr = teamOpr.autoOpr || 0
        teleopOpr = teamOpr.teleopOpr || 0
        endgameOpr = teamOpr.endgameOpr || 0
      }
    } else {
      console.log("Custom OPR data not available")
    }

    // Get ranking data
    let teamRank = 0
    let rp = 0
    let tbp = 0

    const rankings = rankingsResult.data.rankings || []
    const teamRanking = rankings.find(
      (r: any) => r.teamNumber === Number.parseInt(teamNumber)
    )
    if (teamRanking) {
      teamRank = teamRanking.rank || 0
      rp = teamRanking.sortOrder1 ?? teamRanking.rankingPoints ?? teamRanking.rp ?? 0
      tbp = teamRanking.sortOrder2 ?? teamRanking.tieBreakerPoints ?? teamRanking.tbp ?? 0
    }

    const stats = {
      wins,
      losses,
      ties,
      opr,
      dpr,
      autoOpr,
      teleopOpr,
      endgameOpr,
      rank: teamRank,
      rp,
      tbp,
    }

    console.log("Calculated stats with custom OPR:", stats)
    return NextResponse.json({ stats })
  } catch (error) {
    console.error("Error fetching team stats:", error)
    // Return default stats instead of failing
    return NextResponse.json({
      stats: {
        wins: 0,
        losses: 0,
        ties: 0,
        opr: 0,
        dpr: 0,
        rank: 0,
        rp: 0,
        tbp: 0,
      },
    })
  }
}
