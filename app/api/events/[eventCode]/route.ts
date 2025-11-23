import { type NextRequest, NextResponse } from "next/server"
import { ftcApiClient } from "@/lib/ftc-api-client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params
  const bypassCache = request.nextUrl.searchParams.get("bypassCache") === "true"

  try {
    console.log("Fetching event:", eventCode)

    // Get event through cache layer
    const { data, fromCache } = await ftcApiClient.getEvent(eventCode.toUpperCase(), { bypassCache })
    const events = data.events || []

    // Find the specific event
    const event = events.find((e: any) => e.code?.toLowerCase() === eventCode.toLowerCase())

    if (!event) {
      console.log("Event not found:", eventCode)
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    console.log("Found event:", event.name)
    return NextResponse.json({
      event,
      _meta: {
        fromCache,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Error fetching event:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch event",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
