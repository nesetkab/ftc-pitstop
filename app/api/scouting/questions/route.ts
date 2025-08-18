
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

    const questions = await redis.lrange(`questions:${sessionId}`, 0, -1)
    const parsedQuestions = questions.map((q) => JSON.parse(q as string))

    return NextResponse.json(parsedQuestions)
  } catch (error) {
    console.error("Questions fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch questions" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, questionText, questionType, options } = await request.json()

    if (!sessionId || !questionText || !questionType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const questionId = Date.now()
    const question = {
      id: questionId,
      question_text: questionText,
      question_type: questionType,
      options: options || null,
      order_index: await redis.llen(`questions:${sessionId}`),
    }

    await redis.lpush(`questions:${sessionId}`, JSON.stringify(question))

    return NextResponse.json(question)
  } catch (error) {
    console.error("Question creation error:", error)
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 })
  }
}
