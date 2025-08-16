import { type NextRequest, NextResponse } from "next/server"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params

  try {
    const season = process.env.FTC_SEASON
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

    console.log("Fetching teams for event:", eventCode)

    const response = await fetch(`${FTC_API_BASE}/${season}/teams?eventCode=${eventCode.toUpperCase()}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    })

    console.log("Teams API Response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Teams API Error:", errorText)
      throw new Error(`API responded with status: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log("Teams data keys:", Object.keys(data))
    console.log("Number of teams:", data.teams?.length || 0)

    return NextResponse.json({ teams: data.teams || [] })
  } catch (error) {
    console.error("Error fetching teams:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch teams",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
