import { NextResponse } from "next/server"
import { ftcApiClient } from "@/lib/ftc-api-client"

interface Event {
  code: string
  name: string
  dateStart: string
  dateEnd: string
  venue: string
  city: string
  stateprov: string
  country: string
}

export async function GET() {
  try {
    console.log("Fetching upcoming events...")

    // Get all events through cache layer
    const { data, fromCache } = await ftcApiClient.getEvents()
    const allEvents = data.events || []

    // Filter for upcoming and current events
    const now = new Date()
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

    const upcomingEvents = allEvents
      .filter((event: Event) => {
        const eventStart = new Date(event.dateStart)
        const eventEnd = new Date(event.dateEnd)
        // Include events that are currently happening or starting within 2 weeks
        return eventEnd >= now && eventStart <= twoWeeksFromNow
      })
      .sort((a: Event, b: Event) => {
        // Sort by start date, with current events first
        const aStart = new Date(a.dateStart)
        const bStart = new Date(b.dateStart)
        const aIsLive = new Date(a.dateStart) <= now && new Date(a.dateEnd) >= now
        const bIsLive = new Date(b.dateStart) <= now && new Date(b.dateEnd) >= now

        if (aIsLive && !bIsLive) return -1
        if (!aIsLive && bIsLive) return 1
        return aStart.getTime() - bStart.getTime()
      })

    console.log(`Found ${upcomingEvents.length} upcoming events out of ${allEvents.length} total events`)

    return NextResponse.json({
      success: true,
      events: upcomingEvents,
      totalEvents: allEvents.length,
      _meta: {
        fromCache,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Error fetching upcoming events:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
