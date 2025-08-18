
import { type NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export async function POST(request: NextRequest) {
  try {
    const { eventCode, managerName } = await request.json()

    if (!eventCode || !managerName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Generate unique session code
    const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const sessionId = Date.now()

    const session = {
      id: sessionId,
      session_code: sessionCode,
      event_code: eventCode,
      manager_name: managerName,
      is_active: true,
      created_at: new Date().toISOString(),
    }

    // Store session in Redis
    await redis.hset(`session:${sessionCode}`, session)
    await redis.sadd("active_sessions", sessionCode)

    return NextResponse.json(session)
  } catch (error) {
    console.error("Session creation error:", error)
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionCode = searchParams.get("code")

    if (!sessionCode) {
      return NextResponse.json({ error: "Session code required" }, { status: 400 })
    }

    const session = await redis.hgetall(`session:${sessionCode.toUpperCase()}`)

    if (!session || Object.keys(session).length === 0) {
      return NextResponse.json({ error: "Session not found or inactive" }, { status: 404 })
    }

    return NextResponse.json(session)
  } catch (error) {
    console.error("Session lookup error:", error)
    return NextResponse.json({ error: "Failed to lookup session" }, { status: 500 })
  }
}
