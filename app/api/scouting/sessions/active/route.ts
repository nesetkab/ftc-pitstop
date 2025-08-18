import { type NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export async function GET(request: NextRequest) {
  try {
    const activeCodes = await redis.smembers("active_sessions")
    const sessions = []

    for (const code of activeCodes) {
      const session = await redis.hgetall(`session:${code}`)
      if (session && Object.keys(session).length > 0) {
        sessions.push(session)
      }
    }

    return NextResponse.json(sessions)
  } catch (error) {
    console.error("Active sessions error:", error)
    return NextResponse.json({ error: "Failed to fetch active sessions" }, { status: 500 })
  }
}
