import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const season = process.env.FTC_SEASON || "2024"
    const username = process.env.FTC_USERNAME
    const apiKey = process.env.FTC_API_KEY

    if (!username || !apiKey) {
      // Return empty array when credentials aren't configured
      console.log("api keys empty")
      return NextResponse.json([])
    }

    const authHeader = Buffer.from(`${username}:${apiKey}`).toString("base64")
    const response = await fetch(`https://ftc-api.firstinspires.org/v2.0/${season}/events`, {
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      console.error("FTC API error:", response.status, response.statusText)
      return NextResponse.json([])
    }

    const data = await response.json()
    return NextResponse.json(data.events || [])
  } catch (error) {
    console.error("Events API error:", error)
    return NextResponse.json([])
  }
}
