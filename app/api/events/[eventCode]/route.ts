import { type NextRequest, NextResponse } from "next/server"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params

  try {
    // Use 2024 season for now (adjust as needed)
    const season = 2024
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

    console.log("Fetching event:", eventCode)

    // Get all events and filter by code
    const response = await fetch(`${FTC_API_BASE}/${season}/events`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    })

    console.log("API Response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("API Error:", errorText)
      throw new Error(`API responded with status: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const events = data.events || []

    // Find the specific event
    const event = events.find((e: any) => e.code?.toLowerCase() === eventCode.toLowerCase())

    if (!event) {
      console.log("Event not found:", eventCode)
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    console.log("Found event:", event.name)
    return NextResponse.json({ event })
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
