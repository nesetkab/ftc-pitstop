import { Redis } from "@upstash/redis"

interface Event {
  id: string
  code: string
  name: string
  location: string
  venue: string
  date: string
  city: string
  state: string
}

interface Team {
  id: number
  team_number: number
  team_name: string
  name_short: string
  school: string
  city: string
  state: string
}

interface Question {
  id: number
  session_id: number
  question_text: string
  question_type: "text" | "number" | "boolean" | "select"
  options?: string[]
  order_index: number
  created_at: string
}

interface Answer {
  id: number
  session_id: number
  team_id: number
  question_id: number
  answer_value: string
  scout_name: string
  created_at: string
}

interface ScoutingSession {
  id: number
  session_code: string
  event_code: string // Changed from event_id to event_code for FTC API compatibility
  manager_name: string
  is_active: boolean
  created_at: string
  connected_scouts: string[]
  last_activity: string // Added to track session activity
}

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const REDIS_KEYS = {
  SESSION: (code: string) => `session:${code}`,
  SESSIONS_LIST: "sessions:active",
  QUESTIONS: (sessionId: number) => `questions:${sessionId}`,
  ANSWERS: (sessionId: number) => `answers:${sessionId}`,
  EVENTS: "events:cache",
  TEAMS: (eventCode: string) => `teams:${eventCode}`,
  COUNTERS: "counters",
}

class SessionStore {
  private async initializeCounters() {
    const counters = await redis.get(REDIS_KEYS.COUNTERS)
    if (!counters) {
      await redis.set(REDIS_KEYS.COUNTERS, {
        sessionId: 1,
        questionId: 1,
        answerId: 1,
      })
    }
  }

  private async getNextId(type: "sessionId" | "questionId" | "answerId"): Promise<number> {
    const counters = ((await redis.get(REDIS_KEYS.COUNTERS)) as any) || {
      sessionId: 1,
      questionId: 1,
      answerId: 1,
    }
    const nextId = counters[type]
    counters[type] = nextId + 1
    await redis.set(REDIS_KEYS.COUNTERS, counters)
    return nextId
  }

  async createSession(eventCode: string, managerName: string): Promise<ScoutingSession> {
    await this.initializeCounters()

    console.log("[v0] 🏗️ Creating session in Redis:", { eventCode, managerName })

    const sessionCode = await this.generateSessionCode()
    const sessionId = await this.getNextId("sessionId")
    console.log("[v0] 🎲 Generated session code:", sessionCode)

    const now = new Date().toISOString()
    const newSession: ScoutingSession = {
      id: sessionId,
      session_code: sessionCode,
      event_code: eventCode,
      manager_name: managerName,
      is_active: true,
      created_at: now,
      connected_scouts: [],
      last_activity: now,
    }

    await redis.set(REDIS_KEYS.SESSION(sessionCode), newSession)
    await redis.sadd(REDIS_KEYS.SESSIONS_LIST, sessionCode)

    console.log("[v0] ✅ Session created and stored in Redis:", newSession)

    return newSession
  }

  async getSessionByCode(code: string): Promise<ScoutingSession | null> {
    console.log("[v0] 🔍 Looking for session with code in Redis:", code)

    const session = (await redis.get(REDIS_KEYS.SESSION(code))) as ScoutingSession | null

    if (session && session.is_active) {
      console.log("[v0] ✅ Session found in Redis:", session)
      session.last_activity = new Date().toISOString()
      await redis.set(REDIS_KEYS.SESSION(code), session)
      return session
    } else {
      console.log("[v0] ❌ Session not found or inactive in Redis")
      return null
    }
  }

  async addScoutToSession(sessionCode: string, scoutName: string): Promise<boolean> {
    const session = await this.getSessionByCode(sessionCode)
    if (session && !session.connected_scouts.includes(scoutName)) {
      session.connected_scouts.push(scoutName)
      session.last_activity = new Date().toISOString()
      await redis.set(REDIS_KEYS.SESSION(sessionCode), session)
      return true
    }
    return false
  }

  async getAllActiveSessions(): Promise<ScoutingSession[]> {
    console.log("[v0] 📋 Getting all active sessions from Redis")

    const sessionCodes = (await redis.smembers(REDIS_KEYS.SESSIONS_LIST)) as string[]
    const sessions: ScoutingSession[] = []

    for (const code of sessionCodes) {
      const session = (await redis.get(REDIS_KEYS.SESSION(code))) as ScoutingSession | null
      if (session && session.is_active) {
        sessions.push(session)
      } else if (session && !session.is_active) {
        await redis.srem(REDIS_KEYS.SESSIONS_LIST, code)
      }
    }

    console.log("[v0] 📊 Active sessions from Redis:", sessions.length)
    return sessions
  }

  async addQuestion(
    sessionId: number,
    questionText: string,
    questionType: string,
    options?: string[],
  ): Promise<Question> {
    const questionId = await this.getNextId("questionId")
    const existingQuestions = await this.getQuestionsBySession(sessionId)

    const newQuestion: Question = {
      id: questionId,
      session_id: sessionId,
      question_text: questionText,
      question_type: questionType as any,
      options: options,
      order_index: existingQuestions.length + 1,
      created_at: new Date().toISOString(),
    }

    const questions = [...existingQuestions, newQuestion]
    await redis.set(REDIS_KEYS.QUESTIONS(sessionId), questions)
    return newQuestion
  }

  async getQuestionsBySession(sessionId: number): Promise<Question[]> {
    const questions = (await redis.get(REDIS_KEYS.QUESTIONS(sessionId))) as Question[] | null
    return questions || []
  }

  async saveAnswer(
    sessionId: number,
    teamId: number,
    questionId: number,
    answerValue: string,
    scoutName: string,
  ): Promise<Answer> {
    const answerId = await this.getNextId("answerId")
    const existingAnswers = ((await redis.get(REDIS_KEYS.ANSWERS(sessionId))) as Answer[] | null) || []

    const filteredAnswers = existingAnswers.filter((a) => !(a.team_id === teamId && a.question_id === questionId))

    const newAnswer: Answer = {
      id: answerId,
      session_id: sessionId,
      team_id: teamId,
      question_id: questionId,
      answer_value: answerValue,
      scout_name: scoutName,
      created_at: new Date().toISOString(),
    }

    const updatedAnswers = [...filteredAnswers, newAnswer]
    await redis.set(REDIS_KEYS.ANSWERS(sessionId), updatedAnswers)
    return newAnswer
  }

  async getAnswersBySession(sessionId: number): Promise<any[]> {
    const answers = ((await redis.get(REDIS_KEYS.ANSWERS(sessionId))) as Answer[] | null) || []
    const teams = await this.getTeams() // This will need event code context
    const questions = await this.getQuestionsBySession(sessionId)

    return answers.map((answer) => {
      const team = teams.find((t) => t.id === answer.team_id)
      const question = questions.find((q) => q.id === answer.question_id)
      return {
        ...answer,
        team_number: team?.team_number,
        team_name: team?.team_name,
        question_text: question?.question_text,
      }
    })
  }

  async getEvents(): Promise<Event[]> {
    const cached = (await redis.get(REDIS_KEYS.EVENTS)) as { events: Event[]; timestamp: number } | null
    const now = Date.now()
    const cacheTimeout = 5 * 60 * 1000 // 5 minutes

    if (!cached || now - cached.timestamp > cacheTimeout) {
      try {
        const { ftcAPI } = await import("./ftc-api")
        const ftcEvents = await ftcAPI.getEvents(2024)

        const events: Event[] = ftcEvents.map((event) => ({
          id: event.code,
          code: event.code,
          name: event.name,
          location: `${event.city}, ${event.stateprov}`,
          venue: event.venue || event.address,
          date: event.dateStart,
          city: event.city,
          state: event.stateprov,
        }))

        await redis.set(REDIS_KEYS.EVENTS, { events, timestamp: now })
        return events
      } catch (error) {
        console.error("Failed to fetch events from FTC API:", error)
        return cached?.events || []
      }
    }

    return cached.events
  }

  async getTeams(eventCode?: string): Promise<Team[]> {
    if (!eventCode) {
      console.log("No event code provided - cannot fetch teams")
      return []
    }

    const cached = (await redis.get(REDIS_KEYS.TEAMS(eventCode))) as { teams: Team[]; timestamp: number } | null
    const now = Date.now()
    const cacheTimeout = 5 * 60 * 1000 // 5 minutes

    if (!cached || now - cached.timestamp > cacheTimeout) {
      try {
        const { ftcAPI } = await import("./ftc-api")
        const ftcTeams = await ftcAPI.getTeams(2024, eventCode)

        const teams: Team[] = ftcTeams.map((team) => ({
          id: team.teamNumber,
          team_number: team.teamNumber,
          team_name: team.nameFull,
          name_short: team.nameShort,
          school: team.schoolName,
          city: team.city,
          state: team.stateProv,
        }))

        await redis.set(REDIS_KEYS.TEAMS(eventCode), { teams, timestamp: now })
        return teams
      } catch (error) {
        console.error("Failed to fetch teams from FTC API:", error)
        return cached?.teams || []
      }
    }

    return cached.teams
  }

  private async generateSessionCode(): Promise<string> {
    let code: string
    let attempts = 0
    do {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
      code = ""
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      attempts++
      const exists = await redis.exists(REDIS_KEYS.SESSION(code))
      if (!exists) break
    } while (attempts < 10)

    return code
  }

  async getSessionsByEvent(eventCode: string): Promise<ScoutingSession[]> {
    const allSessions = await this.getAllActiveSessions()
    return allSessions.filter((s) => s.event_code === eventCode)
  }

  async cleanupInactiveSessions(): Promise<void> {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000 // 2 hours
    const sessionCodes = (await redis.smembers(REDIS_KEYS.SESSIONS_LIST)) as string[]

    for (const code of sessionCodes) {
      const session = (await redis.get(REDIS_KEYS.SESSION(code))) as ScoutingSession | null
      if (session) {
        const lastActivity = new Date(session.last_activity).getTime()
        if (lastActivity <= cutoff) {
          session.is_active = false
          await redis.set(REDIS_KEYS.SESSION(code), session)
          await redis.srem(REDIS_KEYS.SESSIONS_LIST, code)
        }
      }
    }
  }

  async getConnectedScouts(sessionId: number): Promise<string[]> {
    const allSessions = await this.getAllActiveSessions()
    const session = allSessions.find((s) => s.id === sessionId)
    return session?.connected_scouts || []
  }
}

export const sessionStore = new SessionStore()

if (typeof window === "undefined") {
  setInterval(
    () => {
      sessionStore.cleanupInactiveSessions()
    },
    10 * 60 * 1000,
  ) // Every 10 minutes
}
