import { type NextRequest, NextResponse } from "next/server"
import { ftcApiClient } from "@/lib/ftc-api-client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params
  const searchParams = request.nextUrl.searchParams
  const teamNumber = searchParams.get("team")
  const bypassCache = searchParams.get("bypassCache") === "true"

  try {
    console.log("Fetching team comparison data for event:", eventCode)

    // Get rankings, matches, and our custom OPR data (all through cache)
    const [rankingsResult, matchesResult, oprResponse] = await Promise.all([
      ftcApiClient.getRankings(eventCode.toUpperCase(), { bypassCache }),
      ftcApiClient.getMatches(eventCode.toUpperCase(), { bypassCache }),
      // Use our custom OPR calculation (which now also uses cache)
      fetch(`${request.nextUrl.origin}/api/events/${eventCode}/opr${bypassCache ? '?bypassCache=true' : ''}`),
    ])

    let rankings = []
    let matches = []
    let oprData = []

    if (rankingsResult.data && Array.isArray(rankingsResult.data.rankings)) {
      rankings = rankingsResult.data.rankings
      console.log(`Found ${rankings.length} rankings (fromCache: ${rankingsResult.fromCache})`)
    } else {
      console.warn("Rankings data structure is unexpected:", rankingsResult.data)
    }

    if (matchesResult.data) {
      matches = matchesResult.data.matches || []
      console.log(`Found ${matches.length} matches (fromCache: ${matchesResult.fromCache})`)
    }

    if (oprResponse.ok) {
      const oprResult = await oprResponse.json()
      oprData = oprResult.opr || []
    } else {
      console.log("Custom OPR calculation failed, proceeding without OPR data")
    }

    // Create team statistics map
    const teamStats = new Map()

    // Process rankings
    rankings.forEach((ranking: any) => {
      const totalMatches = (ranking.wins || 0) + (ranking.losses || 0) + (ranking.ties || 0)
      const winRate = totalMatches > 0
        ? ((ranking.wins || 0) + (ranking.ties || 0) * 0.5) / totalMatches * 100
        : 0

      // console.log("i think the ranking is!!", ranking.rank)
      teamStats.set(ranking.teamNumber, {
        teamNumber: ranking.teamNumber,
        rank: ranking.rank,  // Use the rank directly from the API
        rp: ranking.rankingPoints || 0,
        tbp: ranking.tieBreakerPoints || 0,
        wins: ranking.wins || 0,
        losses: ranking.losses || 0,
        ties: ranking.ties || 0,
        played: totalMatches,
        winRate: winRate,
        opr: 0,
        dpr: 0,
        ccwm: 0,
        avgScore: 0,
        highScore: 0,
        avgMargin: 0,
        matchesPlayed: totalMatches,
      })
    })

    matches.forEach((match: any) => {
      if (!match.teams) return

      match.teams.forEach((teamInfo: any) => {
        const teamNum = teamInfo.teamNumber
        if (!teamStats.has(teamNum)) {
          // Create initial stats for teams not in rankings
          const teamMatches = matches.filter((m: any) =>
            m.teams?.some((t: any) => t.teamNumber === teamNum)
          )

          let wins = 0, losses = 0, ties = 0
          teamMatches.forEach((m: any) => {
            if (m.scoreRedFinal === null || m.scoreBlueFinal === null) return
            const isRed = m.teams.find((t: any) => t.teamNumber === teamNum).station.includes("Red")
            const teamScore = isRed ? m.scoreRedFinal : m.scoreBlueFinal
            const oppScore = isRed ? m.scoreBlueFinal : m.scoreRedFinal

            if (teamScore > oppScore) wins++
            else if (teamScore < oppScore) losses++
            else ties++
          })

          const totalMatches = wins + losses + ties
          const winRate = totalMatches > 0
            ? (wins + ties * 0.5) / totalMatches * 100
            : 0

          teamStats.set(teamNum, {
            teamNumber: teamNum,
            rank: rankings.length + 1,  // Place unranked teams after ranked teams
            rp: 0,
            tbp: 0,
            wins,
            losses,
            ties,
            played: totalMatches,
            winRate,
            opr: 0,
            dpr: 0,
            ccwm: 0,
            avgScore: 0,
            highScore: 0,
            avgMargin: 0,
            matchesPlayed: totalMatches,
          })
        }
      })
    })

    // Add our custom OPR data
    oprData.forEach((team: any) => {
      if (teamStats.has(team.teamNumber)) {
        const stats = teamStats.get(team.teamNumber)
        stats.opr = team.opr || 0
        stats.dpr = team.dpr || 0
        stats.ccwm = team.ccwm || 0
        stats.matchesPlayed = team.matchesPlayed || 0
      } else {
        // Create entry for teams that might not be in rankings yet
        teamStats.set(team.teamNumber, {
          teamNumber: team.teamNumber,
          rank: 999, // Default rank for teams not in rankings
          rp: 0,
          tbp: 0,
          wins: 0,
          losses: 0,
          ties: 0,
          played: 0,
          winRate: 0,
          opr: team.opr || 0,
          dpr: team.dpr || 0,
          ccwm: team.ccwm || 0,
          avgScore: 0,
          highScore: 0,
          avgMargin: 0,
          matchesPlayed: team.matchesPlayed || 0,
        })
      }
    })

    // Calculate match-based statistics
    const teamMatchStats = new Map()
    matches.forEach((match: any) => {
      if (!match.teams || match.scoreRedFinal === null || match.scoreBlueFinal === null) return

      match.teams.forEach((teamInfo: any) => {
        const teamNum = teamInfo.teamNumber
        if (!teamMatchStats.has(teamNum)) {
          teamMatchStats.set(teamNum, {
            scores: [],
            margins: [],
          })
        }

        const isRed = teamInfo.station.includes("Red")
        const teamScore = isRed ? match.scoreRedFinal : match.scoreBlueFinal
        const opponentScore = isRed ? match.scoreBlueFinal : match.scoreRedFinal
        const margin = teamScore - opponentScore

        teamMatchStats.get(teamNum).scores.push(teamScore)
        teamMatchStats.get(teamNum).margins.push(margin)
      })
    })

    // Calculate averages and add to team stats
    teamMatchStats.forEach((matchData, teamNum) => {
      if (teamStats.has(teamNum)) {
        const stats = teamStats.get(teamNum)
        const scores = matchData.scores
        const margins = matchData.margins

        if (scores.length > 0) {
          stats.avgScore = scores.reduce((a: number, b: number) => a + b, 0) / scores.length
          stats.highScore = Math.max(...scores)
          stats.avgMargin = margins.reduce((a: number, b: number) => a + b, 0) / margins.length
        }
      }
    })

    // Convert to array and sort by rank
    const allTeams = Array.from(teamStats.values()).sort((a, b) => a.rank - b.rank)

    // Find the specific team if requested
    const targetTeam = teamNumber ? allTeams.find((t) => t.teamNumber === Number.parseInt(teamNumber)) : null

    // Calculate percentiles for the target team
    let percentiles = null
    if (targetTeam) {
      const calculatePercentile = (value: number, allValues: number[]) => {
        const sorted = allValues.filter((v) => v > 0).sort((a, b) => a - b)
        if (sorted.length === 0) return 0
        const index = sorted.findIndex((v) => v >= value)
        return index === -1 ? 100 : Math.round((index / sorted.length) * 100)
      }

      percentiles = {
        rank: Math.round(((allTeams.length - targetTeam.rank + 1) / allTeams.length) * 100),
        opr: calculatePercentile(
          targetTeam.opr,
          allTeams.map((t) => t.opr),
        ),
        dpr:
          100 -
          calculatePercentile(
            targetTeam.dpr,
            allTeams.map((t) => t.dpr),
          ), // Lower DPR is better
        winRate: calculatePercentile(
          targetTeam.winRate,
          allTeams.map((t) => t.winRate),
        ),
        avgScore: calculatePercentile(
          targetTeam.avgScore,
          allTeams.map((t) => t.avgScore),
        ),
        avgMargin: calculatePercentile(
          targetTeam.avgMargin,
          allTeams.map((t) => t.avgMargin),
        ),
      }
    }

    // Get similar teams (teams with similar rank)
    const similarTeams = targetTeam
      ? allTeams
        .filter((t) => t.teamNumber !== targetTeam.teamNumber && Math.abs(t.rank - targetTeam.rank) <= 3)
        .slice(0, 5)
      : []

    // Get top performers in each category
    const topPerformers = {
      opr: allTeams
        .filter((t) => t.opr > 0)
        .sort((a, b) => b.opr - a.opr)
        .slice(0, 5),
      dpr: allTeams
        .filter((t) => t.dpr > 0)
        .sort((a, b) => a.dpr - b.dpr)
        .slice(0, 5), // Lower is better
      winRate: allTeams
        .filter((t) => t.played >= 3)
        .sort((a, b) => b.winRate - a.winRate)
        .slice(0, 5),
      avgScore: allTeams
        .filter((t) => t.avgScore > 0)
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 5),
      highScore: allTeams
        .filter((t) => t.highScore > 0)
        .sort((a, b) => b.highScore - a.highScore)
        .slice(0, 5),
    }

    console.log(`Generated comparison data for ${allTeams.length} teams with custom OPR`)
    return NextResponse.json({
      targetTeam,
      allTeams,
      similarTeams,
      topPerformers,
      percentiles,
      eventStats: {
        totalTeams: allTeams.length,
        avgOPR:
          allTeams.filter((t) => t.opr > 0).reduce((sum, t) => sum + t.opr, 0) /
          allTeams.filter((t) => t.opr > 0).length || 0,
        avgScore:
          allTeams.filter((t) => t.avgScore > 0).reduce((sum, t) => sum + t.avgScore, 0) /
          allTeams.filter((t) => t.avgScore > 0).length || 0,
        highestScore: Math.max(...allTeams.map((t) => t.highScore)),
      },
      oprCalculation: {
        method: "custom_matrix_algebra",
        matchesProcessed: matches.filter((m: any) => m.scoreRedFinal !== null && m.scoreBlueFinal !== null).length,
        teamsAnalyzed: oprData.length,
      },
    })
  } catch (error) {
    console.error("Error generating team comparison:", error)
    return NextResponse.json({
      targetTeam: null,
      allTeams: [],
      similarTeams: [],
      topPerformers: { opr: [], dpr: [], winRate: [], avgScore: [], highScore: [] },
      percentiles: null,
      eventStats: { totalTeams: 0, avgOPR: 0, avgScore: 0, highestScore: 0 },
      oprCalculation: { method: "failed", matchesProcessed: 0, teamsAnalyzed: 0 },
    })
  }
}
