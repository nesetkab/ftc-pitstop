import { NextResponse } from "next/server"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET() {
  try {
    const season = process.env.FTC_SEASON
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

    console.log("Testing FTC API connection...")
    console.log("Username:", process.env.FTC_USERNAME)
    console.log("API Key exists:", !!process.env.FTC_API_KEY)

    // Test basic connection by getting events
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
      console.error("API Error:", errorText)
      return NextResponse.json({
        success: false,
        status: response.status,
        error: errorText,
      })
    }

    const data = await response.json()
    console.log("API Response keys:", Object.keys(data))
    console.log("Events count:", data.events?.length || 0)

    // Show some sample event codes
    const sampleEvents =
      data.events?.slice(0, 10).map((e: any) => ({
        code: e.code,
        name: e.name,
        city: e.city,
        state: e.stateProv,
      })) || []

    return NextResponse.json({
      success: true,
      status: response.status,
      totalEvents: data.events?.length || 0,
      sampleEvents,
    })
  } catch (error) {
    console.error("Connection test failed:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}
