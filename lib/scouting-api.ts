
import type { Event, Team, Question, Answer, ScoutingSession, Analytics } from "./types/scouting"

const API_BASE = "/api/scouting"

export class ScoutingAPI {
  // Sessions
  static async createSession(eventCode: string, managerName: string): Promise<ScoutingSession> {
    const response = await fetch(`${API_BASE}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventCode, managerName }),
    })
    if (!response.ok) throw new Error("Failed to create session")
    return response.json()
  }

  static async getSession(sessionCode: string): Promise<ScoutingSession> {
    const response = await fetch(`${API_BASE}/sessions?code=${sessionCode}`)
    if (!response.ok) throw new Error("Session not found")
    return response.json()
  }

  static async getActiveSessions(): Promise<ScoutingSession[]> {
    const response = await fetch(`${API_BASE}/sessions/active`)
    if (!response.ok) throw new Error("Failed to fetch active sessions")
    return response.json()
  }

  // Events
  static async getEvents(): Promise<Event[]> {
    const response = await fetch(`${API_BASE}/events`)
    if (!response.ok) throw new Error("Failed to fetch events")
    return response.json()
  }

  // Teams
  static async getTeams(eventCode: string): Promise<Team[]> {
    const response = await fetch(`${API_BASE}/teams?eventCode=${eventCode}`)
    if (!response.ok) throw new Error("Failed to fetch teams")
    return response.json()
  }

  // Questions
  static async getQuestions(sessionId: number): Promise<Question[]> {
    const response = await fetch(`${API_BASE}/questions?sessionId=${sessionId}`)
    if (!response.ok) throw new Error("Failed to fetch questions")
    return response.json()
  }

  static async addQuestion(
    sessionId: number,
    questionText: string,
    questionType: string,
    options?: string[],
  ): Promise<Question> {
    const response = await fetch(`${API_BASE}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, questionText, questionType, options }),
    })
    if (!response.ok) throw new Error("Failed to add question")
    return response.json()
  }

  // Answers
  static async getAnswers(sessionId: number): Promise<Answer[]> {
    const response = await fetch(`${API_BASE}/answers?sessionId=${sessionId}`)
    if (!response.ok) throw new Error("Failed to fetch answers")
    return response.json()
  }

  static async submitAnswer(
    sessionId: number,
    teamId: number,
    questionId: number,
    answerValue: string,
    scoutName: string,
  ): Promise<Answer> {
    const response = await fetch(`${API_BASE}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, teamId, questionId, answerValue, scoutName }),
    })
    if (!response.ok) throw new Error("Failed to submit answer")
    return response.json()
  }

  // Scouts
  static async joinSession(sessionCode: string, scoutName: string): Promise<void> {
    const response = await fetch(`${API_BASE}/scouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionCode, scoutName }),
    })
    if (!response.ok) throw new Error("Failed to join session")
  }

  static async getConnectedScouts(sessionId: number): Promise<string[]> {
    const response = await fetch(`${API_BASE}/scouts?sessionId=${sessionId}`)
    if (!response.ok) throw new Error("Failed to fetch connected scouts")
    return response.json()
  }

  // Analytics
  static async getAnalytics(sessionId: number): Promise<Analytics> {
    const response = await fetch(`${API_BASE}/analytics?sessionId=${sessionId}`)
    if (!response.ok) throw new Error("Failed to fetch analytics")
    return response.json()
  }

  // Export
  static async exportData(sessionId: number, format: "json" | "csv"): Promise<Blob | any> {
    const response = await fetch(`${API_BASE}/export?sessionId=${sessionId}&format=${format}`)
    if (!response.ok) throw new Error("Failed to export data")

    if (format === "csv") {
      return response.blob()
    } else {
      return response.json()
    }
  }
}
