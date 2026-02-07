import { type NextRequest, NextResponse } from "next/server"
import { ftcApiClient } from "@/lib/ftc-api-client"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")
  const bypassCache = searchParams.get("bypassCache") === "true"

  if (!query) {
    return NextResponse.json({ error: "Query parameter required" }, { status: 400 })
  }

  try {
    console.log("Searching for events with query:", query)

    // Get all events for the season through cache layer
    const { data, fromCache } = await ftcApiClient.getEvents({ bypassCache })

    console.log("Events data:", {
      hasEvents: !!data.events,
      eventCount: data.events?.length || 0,
      fromCache,
    })

    // Filter events based on query
    const allEvents = data.events || []
    const filteredEvents = allEvents.filter(
      (event: any) =>
        event.name?.toLowerCase().includes(query.toLowerCase()) ||
        event.venue?.toLowerCase().includes(query.toLowerCase()) ||
        event.city?.toLowerCase().includes(query.toLowerCase()) ||
        event.code?.toLowerCase().includes(query.toLowerCase()) ||
        event.code?.toLowerCase() === query.toLowerCase(),
    )

    console.log(`Found ${filteredEvents.length} matching events out of ${allEvents.length} total events`)

    return NextResponse.json({
      events: filteredEvents,
      totalEvents: allEvents.length,
      searchQuery: query,
      _meta: {
        fromCache,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Error searching events:", error)
    return NextResponse.json(
      {
        error: "Failed to search events",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
