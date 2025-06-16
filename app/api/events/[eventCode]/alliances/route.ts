import { type NextRequest, NextResponse } from "next/server"

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params

  try {
    const season = 2024
    const auth = Buffer.from(`${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`).toString("base64")

    console.log("Fetching alliances for event:", eventCode)

    const response = await fetch(`${FTC_API_BASE}/${season}/alliances/${eventCode.toUpperCase()}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    })

    console.log("Alliances API Response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Alliances API Error:", errorText)

      // Return empty alliances instead of failing
      console.log("Alliances not available, returning empty array")
      return NextResponse.json({ alliances: [] })
    }

    const data = await response.json()
    console.log("Alliances data structure:", {
      hasAlliances: !!data.alliances,
      allianceCount: data.alliances?.length || 0,
      dataKeys: Object.keys(data),
    })

    // Transform alliances to match our expected format
    const transformedAlliances =
      data.alliances?.map((alliance: any) => ({
        number: alliance.number,
        captain: alliance.captain,
        round1: alliance.round1,
        round2: alliance.round2,
        backup: alliance.backup,
        name: alliance.name,
      })) || []

    console.log("Transformed alliances count:", transformedAlliances.length)
    return NextResponse.json({ alliances: transformedAlliances })
  } catch (error) {
    console.error("Error fetching alliances:", error)
    // Return empty alliances instead of failing
    return NextResponse.json({ alliances: [] })
  }
}
