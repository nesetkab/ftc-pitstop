import { NextResponse } from "next/server"
import { sessionStore } from "@/lib/session-store"

export async function POST(request: Request) {
  try {
    const { sessionCode, scoutName } = await request.json()

    if (!sessionCode || !scoutName) {
      return NextResponse.json({ error: "Session code and scout name are required" }, { status: 400 })
    }

    const success = sessionStore.addScoutToSession(sessionCode.toUpperCase(), scoutName)

    if (success) {
      return NextResponse.json({ message: "Scout connected successfully" })
    } else {
      return NextResponse.json({ error: "Failed to connect scout or scout already connected" }, { status: 400 })
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to connect scout" }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (sessionId) {
      const scouts = sessionStore.getConnectedScouts(Number.parseInt(sessionId))
      return NextResponse.json(scouts)
    }

    return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch connected scouts" }, { status: 500 })
  }
}
