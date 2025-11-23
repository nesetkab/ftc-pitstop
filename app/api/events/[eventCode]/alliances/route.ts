import { type NextRequest, NextResponse } from "next/server"
import { ftcApiClient } from "@/lib/ftc-api-client"

export async function GET(request: NextRequest, { params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = await params
  const bypassCache = request.nextUrl.searchParams.get("bypassCache") === "true"

  try {
    console.log("Fetching alliances for event:", eventCode)

    // Get alliances through cache layer
    const { data, fromCache } = await ftcApiClient.getAlliances(eventCode.toUpperCase(), { bypassCache })

    console.log("Alliances data structure:", {
      hasAlliances: !!data.alliances,
      allianceCount: data.alliances?.length || 0,
      fromCache,
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
    return NextResponse.json({
      alliances: transformedAlliances,
      _meta: {
        fromCache,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error("Error fetching alliances:", error)
    // Return empty alliances instead of failing
    return NextResponse.json({ alliances: [] })
  }
}
