import { NextResponse } from "next/server"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET() {
  try {
    const season = 2024
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

    console.log("Fetching upcoming events...")

    const response = await fetch(`${FTC_API_BASE}/${season}/events`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("API Error:", errorText)
      return NextResponse.json({
        success: false,
        error: errorText,
      })
    }

    const data = await response.json()
    const allEvents = data.events || []

    // Filter for upcoming and current events
    const now = new Date()
    const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

    const upcomingEvents = allEvents
      .filter((event: any) => {
        const eventStart = new Date(event.dateStart)
        const eventEnd = new Date(event.dateEnd)
        // Include events that are currently happening or starting within 2 weeks
        return eventEnd >= now && eventStart <= twoWeeksFromNow
      })
      .sort((a: any, b: any) => {
        // Sort by start date, with current events first
        const aStart = new Date(a.start)
        const bStart = new Date(b.start)
        const aIsLive = new Date(a.start) <= now && new Date(a.end) >= now
        const bIsLive = new Date(b.start) <= now && new Date(b.end) >= now

        if (aIsLive && !bIsLive) return -1
        if (!aIsLive && bIsLive) return 1
        return aStart.getTime() - bStart.getTime()
      })

    console.log(`Found ${upcomingEvents.length} upcoming events out of ${allEvents.length} total events`)

    return NextResponse.json({
      success: true,
      events: upcomingEvents,
      totalEvents: allEvents.length,
    })
  } catch (error) {
    console.error("Error fetching upcoming events:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
