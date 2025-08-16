import { type NextRequest, NextResponse } from "next/server"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET(request: NextRequest, { params }: { params: Promise<{ teamNumber: string; eventCode: string }> }) {
  const { teamNumber, eventCode } = await params

  try {
    const season = process.env.FTC_SEASON
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

    console.log("Fetching stats for team:", teamNumber, "at event:", eventCode)

    // Fetch team's matches and our custom OPR data
    const [matchesResponse, oprResponse, rankingsResponse] = await Promise.all([
      fetch(`${FTC_API_BASE}/${season}/matches/${eventCode.toUpperCase()}?teamNumber=${teamNumber}`, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      }),
      // Use our custom OPR calculation
      fetch(`${request.nextUrl.origin}/api/events/${eventCode}/opr`),
      fetch(`${FTC_API_BASE}/${season}/rankings/${eventCode.toUpperCase()}`, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      }),
    ])

    let matches = []
    if (matchesResponse.ok) {
      const matchesData = await matchesResponse.json()
      matches = matchesData.matches || []
    } else {
      console.log("Team-specific matches not available, fetching all matches")
      // Fallback: get all matches and filter
      const allMatchesResponse = await fetch(`${FTC_API_BASE}/${season}/matches/${eventCode.toUpperCase()}`, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
        },
      })

      if (allMatchesResponse.ok) {
        const allMatchesData = await allMatchesResponse.json()
        matches = (allMatchesData.matches || []).filter((match: any) =>
          match.teams?.some((team: any) => team.teamNumber === Number.parseInt(teamNumber)),
        )
      }
    }

    console.log("Found matches for team:", matches.length)

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
      ccwm = 0

    if (oprResponse.ok) {
      const oprData = await oprResponse.json()
      const teamOpr = oprData.opr?.find((o: any) => o.teamNumber === Number.parseInt(teamNumber))
      if (teamOpr) {
        opr = teamOpr.opr || 0
        dpr = teamOpr.dpr || 0
        ccwm = teamOpr.ccwm || 0
      }
    } else {
      console.log("Custom OPR data not available")
    }

    let teamRank = 0;
    if (rankingsResponse.ok) {
      const rankingsData = await rankingsResponse.json();
      const teamRanking = rankingsData.Rankings?.find(
        (r: any) => r.teamNumber === Number.parseInt(teamNumber)
      );
      if (teamRanking) {
        teamRank = teamRanking.rank;
        // Also update rp and tbp while we have the data
        stats.rp = teamRanking.rp || 0;
        stats.tbp = teamRanking.tbp || 0;
      }
    }

    const stats = {
      wins,
      losses,
      ties,
      opr,
      dpr,
      ccwm,
      rank: teamRank,
      rp: 0,
      tbp: 0,
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
        ccwm: 0,
        rank: 0,
        rp: 0,
        tbp: 0,
      },
    })
  }
}
