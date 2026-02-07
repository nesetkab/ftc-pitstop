import { type NextRequest, NextResponse } from "next/server"
import { cacheManager, CACHE_TTL } from "@/lib/cache-manager"

const NEXUS_API_BASE = "https://ftc.nexus/api/v1"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventCode: string }> }
) {
  const { eventCode } = await params
  const apiKey = process.env.NEXUS_API_KEY

  if (!apiKey) {
    return NextResponse.json({
      available: false,
      reason: "Nexus API key not configured",
    })
  }

  try {
    // Check cache first
    const cacheKey = `nexus-${eventCode}`
    const cached = await cacheManager.get<any>("nexus", cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const headers: Record<string, string> = {
      "Nexus-Api-Key": apiKey,
      Accept: "application/json",
    }

    // First check if the event is tracked on Nexus
    const eventResponse = await fetch(`${NEXUS_API_BASE}/event/${eventCode}`, { headers })

    if (!eventResponse.ok) {
      const result = {
        available: false,
        reason: eventResponse.status === 404 ? "Event not tracked on Nexus" : "Nexus API error",
        _meta: { timestamp: new Date().toISOString() },
      }
      // Cache "not found" for 5 minutes to avoid hammering the API
      await cacheManager.set("nexus", cacheKey, result, CACHE_TTL.EVENTS)
      return NextResponse.json(result)
    }

    const eventData = await eventResponse.json()

    // Extract useful data from Nexus response
    const matches = eventData.matches || []
    const nowQueuing = eventData.nowQueuing || null
    const announcements = (eventData.announcements || []).map((a: any) => ({
      text: a.announcement,
      postedByTeam: a.postedByTeam || null,
    }))
    const partsRequests = (eventData.partsRequests || []).map((p: any) => ({
      parts: p.parts,
      requestedByTeam: p.requestedByTeam,
    }))

    // Process match timing data
    const matchTimings = matches.map((m: any) => ({
      label: m.label,
      status: m.status,
      redTeams: m.redTeams || [],
      blueTeams: m.blueTeams || [],
      replayOf: m.replayOf || null,
      estimatedStartTime: m.times?.estimatedStartTime || null,
      actualStartTime: m.times?.actualStartTime || null,
      estimatedQueueTime: m.times?.estimatedQueueTime || null,
    }))

    const result = {
      available: true,
      eventKey: eventCode,
      dataAsOfTime: eventData.dataAsOfTime || null,
      nowQueuing,
      matches: matchTimings,
      announcements,
      partsRequests,
      _meta: { timestamp: new Date().toISOString() },
    }

    // Cache for 30 seconds (match data changes quickly during events)
    await cacheManager.set("nexus", cacheKey, result, CACHE_TTL.MATCHES)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching Nexus data:", error)
    return NextResponse.json({
      available: false,
      reason: "Failed to connect to Nexus",
      _meta: { timestamp: new Date().toISOString() },
    })
  }
}
