export interface Event {
  id: number
  name: string
  location: string
  date: string
  code: string
}

export interface Team {
  id: number
  team_number: number
  team_name: string
  school: string
  city: string
  state: string
}

export interface Question {
  id: number
  question_text: string
  question_type: "text" | "number" | "boolean" | "select"
  options?: string[]
  order_index: number
}

export interface Answer {
  id: number
  session_id: number
  team_id: number
  question_id: number
  answer_value: string
  scout_name: string
  created_at: string
}

export interface ScoutingSession {
  id: number
  session_code: string
  event_code: string
  manager_name: string
  is_active: boolean
  created_at: string
}

export interface Analytics {
  summary: {
    total_teams_scouted: number
    total_responses: number
    total_scouts: number
    total_questions: number
    average_responses_per_team: number
  }
  question_stats: QuestionStat[]
  team_stats: TeamStat[]
}

export interface QuestionStat {
  question_id: number
  question_text: string
  question_type: string
  responses: number
  response_rate: number
  average?: number
  boolean_stats?: {
    yesCount: number
    noCount: number
    yes: number
    no: number
  }
  select_stats?: {
    option: string
    count: number
    percentage: number
  }[]
}

export interface TeamStat {
  team_id: number
  team_number: number
  team_name: string
  responses: number
  completion_rate: number
  scout_count: number
  scouts: string[]
}
