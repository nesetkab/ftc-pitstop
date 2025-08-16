import { type NextRequest, NextResponse } from "next/server"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get("q")

  if (!query) {
    return NextResponse.json({ error: "Query parameter required" }, { status: 400 })
  }

  try {
    const season = process.env.FTC_SEASON
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

    console.log("Searching for events with query:", query)
    console.log("Using season:", season)
    console.log("Auth header created:", auth ? "Yes" : "No")

    // Get all events for the season
    const response = await fetch(`${FTC_API_BASE}/${season}/events`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    })

    console.log("API Response status:", response.status)
    console.log("API Response headers:", Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.error("API Error response:", errorText)
      return NextResponse.json(
        {
          error: "Failed to fetch events from FTC API",
          details: `Status: ${response.status}, Response: ${errorText}`,
        },
        { status: response.status },
      )
    }

    const data = await response.json()
    console.log("API Response data structure:", {
      hasEvents: !!data.events,
      eventCount: data.events?.length || 0,
      firstEventCode: data.events?.[0]?.code,
      dataKeys: Object.keys(data),
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

    // If no matches found, let's see what events are available
    if (filteredEvents.length === 0 && allEvents.length > 0) {
      console.log(
        "Sample event codes:",
        allEvents.slice(0, 10).map((e: any) => e.code),
      )
    }

    return NextResponse.json({
      events: filteredEvents,
      totalEvents: allEvents.length,
      searchQuery: query,
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
