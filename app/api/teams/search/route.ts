import { type NextRequest, NextResponse } from "next/server"
import { cacheManager, CACHE_TTL } from "@/lib/cache-manager"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")

  if (!query || !/^\d+$/.test(query.trim())) {
    return NextResponse.json({ error: "Team search requires a numeric team number" }, { status: 400 })
  }

  const teamNumber = parseInt(query.trim(), 10)

  try {
    // Check cache first
    const cacheKey = `team-events-${teamNumber}`
    const cached = await cacheManager.get<any>("team-search", cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const season = process.env.FTC_SEASON || "2025"
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")
    const headers = { Authorization: `Basic ${auth}`, Accept: "application/json" }

    // Fetch team info and team's events in parallel
    // The FTC API supports ?teamNumber= on the events endpoint directly
    const [teamResponse, eventsResponse] = await Promise.all([
      fetch(`${FTC_API_BASE}/${season}/teams?teamNumber=${teamNumber}`, { headers }),
      fetch(`${FTC_API_BASE}/${season}/events?teamNumber=${teamNumber}`, { headers }),
    ])

    let teamInfo: any = null
    if (teamResponse.ok) {
      const teamData = await teamResponse.json()
      teamInfo = teamData.teams?.[0] || null
    }

    let teamEvents: any[] = []
    if (eventsResponse.ok) {
      const eventsData = await eventsResponse.json()
      const events = eventsData.events || []

      // Map to our event format and sort by proximity to now
      const now = new Date()
      teamEvents = events.map((e: any) => ({
        code: e.code,
        name: e.name,
        dateStart: e.dateStart,
        dateEnd: e.dateEnd,
        venue: e.venue,
        city: e.city,
        stateprov: e.stateprov,
        country: e.country,
      }))

      teamEvents.sort((a: any, b: any) => {
        const aStart = new Date(a.dateStart).getTime()
        const bStart = new Date(b.dateStart).getTime()
        return Math.abs(aStart - now.getTime()) - Math.abs(bStart - now.getTime())
      })
    }

    const result = {
      teamNumber,
      teamInfo,
      events: teamEvents,
      _meta: { timestamp: new Date().toISOString() },
    }

    // Cache for 10 minutes
    await cacheManager.set("team-search", cacheKey, result, CACHE_TTL.TEAMS)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error searching for team:", error)
    return NextResponse.json(
      { error: "Failed to search for team", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
