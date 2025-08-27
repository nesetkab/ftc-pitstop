import { type NextRequest, NextResponse } from "next/server"
import { JsonDelCommand, Redis } from "@upstash/redis"

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

    // Add robust error handling for malformed JSON
    const parsedQuestions = questions
      .map((q, index) => {
        try {
          const parsed = JSON.parse(q as string)
          // Validate that it's a proper question object
          if (parsed && typeof parsed === 'object' && parsed.question_text) {
            return parsed
          } else {
            console.warn(`Invalid question object at index ${index}:`, parsed)
            return null
          }
        } catch (parseError) {
          console.error(`Failed to parse question at index ${index}:`, q, parseError)
          return null
        }
      })
      .filter((q): q is NonNullable<typeof q> => q !== null)
      .sort((a, b) => a.order_index - b.order_index) // Ensure proper ordering

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
    const currentLength = await redis.llen(`questions:${sessionId}`)

    const question = {
      id: questionId,
      question_text: questionText,
      question_type: questionType,
      options: options || null,
      order_index: currentLength, // Use the length as the order index
    }

    // Use rpush to add to the end (maintain order)
    await redis.rpush(`questions:${sessionId}`, JSON.stringify(question))

    return NextResponse.json(question)
  } catch (error) {
    console.error("Question creation error:", error)
    return NextResponse.json({ error: "Failed to create question" }, { status: 500 })
  }
}
