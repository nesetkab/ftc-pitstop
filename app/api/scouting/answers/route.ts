import { type NextRequest, NextResponse } from "next/server"
import { Redis } from "@upstash/redis"

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get("sessionId")

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID required" }, { status: 400 })
    }

    const answers = await redis.lrange(`answers:${sessionId}`, 0, -1)
    const parsedAnswers = answers.map((a) => JSON.parse(a as string))

    return NextResponse.json(parsedAnswers)
  } catch (error) {
    console.error("Answers fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch answers" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, teamId, questionId, answerValue, scoutName } = await request.json()

    if (!sessionId || !teamId || !questionId || !answerValue || !scoutName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const answerId = Date.now()
    const answer = {
      id: answerId,
      session_id: sessionId,
      team_id: teamId,
      question_id: questionId,
      answer_value: answerValue,
      scout_name: scoutName,
      created_at: new Date().toISOString(),
    }

    await redis.lpush(`answers:${sessionId}`, JSON.stringify(answer))

    return NextResponse.json(answer)
  } catch (error) {
    console.error("Answer submission error:", error)
    return NextResponse.json({ error: "Failed to submit answer" }, { status: 500 })
  }
}
