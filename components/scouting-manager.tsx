"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Plus, Copy, Check, Users, ClipboardList, BarChart3, Download, RefreshCw, Search, AlertCircle, Calendar } from "lucide-react"
import { toast } from "sonner"

interface ScoutingManagerProps {
  sessionId?: string
  eventCode?: string
  managerName?: string
  onSessionCreate?: (sessionCode: string) => void
}

// Original Event interface for data from /api/scouting/events
interface Event {
  id: number
  name: string
  location: string
  date: string
  code: string
}

// New interface for richer data from the event search API /api/events/search
interface SearchedEvent {
  code: string
  name: string
  dateStart: string
  dateEnd: string
  venue: string
  city: string
  stateprov: string
  country: string
}

interface Team {
  id: number
  team_number: number
  team_name: string
  school: string
  city: string
  state: string
}

interface Question {
  id: number
  question_text: string
  question_type: "text" | "number" | "boolean" | "select"
  options?: string[]
  order_index: number
}

interface Answer {
  team_id: number
  team_number: number
  team_name: string
  question_id: number
  question_text: string
  answer_value: string
  scout_name: string
}

interface ScoutingSession {
  id: number
  session_code: string
  event_code: string
  manager_name: string
  is_active: boolean
}

interface Analytics {
  summary: {
    total_teams_scouted: number
    total_responses: number
    total_scouts: number
    total_questions: number
    average_responses_per_team: number
  }
  question_stats: any[]
  team_stats: any[]
}

export default function ScoutingManager({
  sessionId,
  eventCode: initialEventCode,
  managerName: initialManagerName,
  onSessionCreate,
}: ScoutingManagerProps) {
  // State for existing event list (used to display name after session creation)
  const [events, setEvents] = useState<Event[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [session, setSession] = useState<ScoutingSession | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [newQuestion, setNewQuestion] = useState({
    text: "",
    type: "text" as const,
    options: [""],
  })
  const [copied, setCopied] = useState(false)
  const [connectedScouts, setConnectedScouts] = useState<string[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [loading, setLoading] = useState(true)

  // State for session creation form
  const [selectedEvent, setSelectedEvent] = useState(initialEventCode || "")
  const [managerName, setManagerName] = useState(initialManagerName || "")
  const [isCreatingSession, setIsCreatingSession] = useState(false)

  // New state for event search functionality
  const [searchTerm, setSearchTerm] = useState("")
  const [searchedEvents, setSearchedEvents] = useState<SearchedEvent[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    if (sessionId) {
      fetchSessionById(sessionId)
    } else {
      // We no longer need to pre-load all events, search is now user-initiated.
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (session) {
      fetchEvents() // Still needed to get event name from code
      fetchTeamsForEvent(session.event_code || "")
      fetchQuestions()
      fetchAnswers()
      fetchConnectedScouts()
      fetchAnalytics()
    }
  }, [session])

  const fetchSessionById = async (sessionCode: string) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/scouting/sessions?code=${sessionCode}`)
      if (response.ok) {
        const sessionData = await response.json()
        setSession(sessionData)
      } else {
        toast.error("Session not found")
      }
    } catch (error) {
      toast.error("Failed to load session")
    } finally {
      setLoading(false)
    }
  }

  const createSession = async () => {
    if (!managerName.trim() || !selectedEvent) {
      toast.error("Please enter your name and select an event.")
      return
    }

    setIsCreatingSession(true)
    try {
      const response = await fetch("/api/scouting/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventCode: selectedEvent, managerName }),
      })

      if (response.ok) {
        const data = await response.json()
        setSession(data)
        onSessionCreate?.(data.session_code)
        toast.success("Success!", { description: `Session created with code: ${data.session_code}` })
      } else {
        toast.error("Failed to create session")
      }
    } catch (error) {
      toast.error("Failed to create session")
    } finally {
      setIsCreatingSession(false)
    }
  }

  // This function now primarily serves to find an event's name from its code after a session is loaded.
  const fetchEvents = async () => {
    try {
      const response = await fetch("/api/scouting/events")
      if (response.ok) {
        const data = await response.json()
        setEvents(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error("Failed to fetch events:", error)
    }
  }

  // New function to search for events, adapted from page.tsx
  const searchEvents = async () => {
    if (!searchTerm.trim()) return
    setIsSearching(true)
    setSearchError(null)
    try {
      const response = await fetch(`/api/events/search?q=${encodeURIComponent(searchTerm)}`)
      const data = await response.json()
      if (!response.ok) {
        setSearchError(`Error: ${data.error || "Failed to search events"}`)
        setSearchedEvents([])
      } else {
        const eventsData = data.events || []
        setSearchedEvents(eventsData)
        if (eventsData.length === 0) {
          setSearchError(`No events found matching "${searchTerm}". Try a different query.`)
        }
      }
    } catch (error) {
      setSearchError("Failed to search events. Please check your connection and try again.")
      setSearchedEvents([])
    } finally {
      setIsSearching(false)
    }
  }

  const fetchTeamsForEvent = async (eventCode: string) => {
    try {
      const response = await fetch(`/api/scouting/teams?eventCode=${eventCode}`)
      if (response.ok) {
        const data = await response.json()
        setTeams(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error("Failed to fetch teams:", error)
    }
  }

  const fetchQuestions = async () => {
    if (!session) return
    try {
      const response = await fetch(`/api/scouting/questions?sessionId=${session.id}`)
      const data = await response.json()
      setQuestions(data)
    } catch (error) {
      toast.error("Failed to fetch questions")
    }
  }

  const fetchAnswers = async () => {
    if (!session) return
    try {
      const response = await fetch(`/api/scouting/answers?sessionId=${session.id}`)
      const data = await response.json()
      setAnswers(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error("Failed to fetch answers:", error)
      setAnswers([])
      toast.error("Failed to fetch answers")
    }
  }

  const fetchConnectedScouts = async () => {
    if (!session) return
    try {
      const response = await fetch(`/api/scouting/scouts?sessionId=${session.id}`)
      const data = await response.json()
      setConnectedScouts(data)
    } catch (error) {
      // Silently fail for polling
    }
  }

  const fetchAnalytics = async () => {
    if (!session) return
    try {
      const response = await fetch(`/api/scouting/analytics?sessionId=${session.id}`)
      const data = await response.json()
      setAnalytics(data)
    } catch (error) {
      // Silently fail for polling
    }
  }

  const refreshData = async () => {
    setIsRefreshing(true)
    await Promise.all([fetchAnswers(), fetchConnectedScouts(), fetchAnalytics()])
    setIsRefreshing(false)
    toast.info("Refreshed", { description: "Data updated successfully" })
  }

  const exportData = async (format: "json" | "csv") => {
    if (!session) return

    try {
      const response = await fetch(`/api/scouting/export?sessionId=${session.id}&format=${format}`)

      if (format === "csv") {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `scouting-data-${session.session_code}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `scouting-data-${session.session_code}.json`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }

      toast.success("Exported", { description: `Data exported as ${format.toUpperCase()}` })
    } catch (error) {
      toast.error("Failed to export data")
    }
  }

  const addQuestion = async () => {
    if (!session || !newQuestion.text) return

    try {
      const response = await fetch("/api/scouting/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          questionText: newQuestion.text,
          questionType: newQuestion.type,
          options: newQuestion.type === "select" ? newQuestion.options.filter((o) => o.trim()) : null,
        }),
      })

      if (response.ok) {
        setNewQuestion({ text: "", type: "text", options: [""] })
        fetchQuestions()
        toast.success("Question added!")
      } else {
        toast.error("Failed to add question")
      }
    } catch (error) {
      toast.error("Failed to add question")
    }
  }

  const copySessionCode = () => {
    if (session) {
      navigator.clipboard.writeText(session.session_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success("Copied!", { description: "Session code copied to clipboard" })
    }
  }

  const copySessionUrl = () => {
    const url = `${window.location.origin}/scout/${session?.session_code}`
    navigator.clipboard.writeText(url)
    toast.success("Copied!", { description: "Scout URL copied to clipboard" })
  }

  const addOption = () => {
    setNewQuestion((prev) => ({
      ...prev,
      options: [...prev.options, ""],
    }))
  }

  const updateOption = (index: number, value: string) => {
    setNewQuestion((prev) => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === index ? value : opt)),
    }))
  }

  const removeOption = (index: number) => {
    setNewQuestion((prev) => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index),
    }))
  }

  const getTeamAnswers = (teamId: number) => {
    return (answers || []).filter((answer) => answer.team_id === teamId)
  }

  const getAnsweredTeams = () => {
    const safeAnswers = Array.isArray(answers) ? answers : []
    const teamIds = [...new Set(safeAnswers.map((a) => a.team_id))]
    return Array.isArray(teams) ? teams.filter((team) => teamIds.includes(team.id)) : []
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="text-lg">Loading session...</div>
        </CardContent>
      </Card>
    )
  }

  if (!session) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Scouting Session</CardTitle>
            <CardDescription>Set up a new scouting session for your event</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manager-name">Manager Name</Label>
              <Input
                id="manager-name"
                placeholder="Enter your name"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
              />
            </div>

            {/* --- New Event Search UI --- */}
            <div className="space-y-2">
              <Label htmlFor="event-search">Search for Event</Label>
              <div className="flex gap-2">
                <Input
                  id="event-search"
                  placeholder="Try: Championship, League Meet, or state"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchEvents()}
                />
                <Button onClick={searchEvents} disabled={isSearching}>
                  {isSearching ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {searchError && (
              <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{searchError}</span>
                </div>
              </div>
            )}

            {searchedEvents.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto p-1">
                <Label>Select an Event:</Label>
                {searchedEvents.map((event) => (
                  <Card
                    key={event.code}
                    className={`cursor-pointer hover:shadow-md transition-all ${selectedEvent === event.code
                      ? "border-blue-500 ring-2 ring-blue-500"
                      : "border-transparent"
                      }`}
                    onClick={() => setSelectedEvent(event.code)}
                  >
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary">{event.code}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.dateStart).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="font-semibold text-sm">{event.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {event.venue} • {event.city}, {event.stateprov}
                          </p>
                        </div>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {/* --- End Event Search UI --- */}

            <Button
              onClick={createSession}
              disabled={!managerName.trim() || !selectedEvent || isCreatingSession}
              className="w-full"
            >
              {isCreatingSession ? "Creating..." : "Create Session"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Session Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Active Session</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={refreshData} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Badge variant="secondary" className="text-lg px-4 py-2">
                Code: {session.session_code}
                <Button variant="ghost" size="sm" onClick={copySessionCode} className="ml-2 h-6 w-6 p-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </Badge>
              <Button variant="outline" size="sm" onClick={copySessionUrl}>
                Copy Scout URL
              </Button>
            </div>
          </CardTitle>
          <CardDescription className="space-y-1">
            <div>
              Manager: {session.manager_name} | Event:{" "}
              {(events || []).find((e) => e.code === session.event_code)?.name || session.event_code}
            </div>
            <div className="flex items-center gap-2">
              <span>Connected Scouts ({(connectedScouts || []).length}):</span>
              {(connectedScouts || []).length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {(connectedScouts || []).map((scout, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {scout}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-gray-500">None</span>
              )}
            </div>
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Analytics Summary */}
      {analytics && analytics.summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{analytics.summary.total_teams_scouted}</div>
              <div className="text-sm text-gray-600">Teams Scouted</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{analytics.summary.total_responses}</div>
              <div className="text-sm text-gray-600">Total Responses</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">{analytics.summary.total_scouts}</div>
              <div className="text-sm text-gray-600">Active Scouts</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">{analytics.summary.average_responses_per_team}</div>
              <div className="text-sm text-gray-600">Avg Responses/Team</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="questions" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="questions" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Questions
          </TabsTrigger>
          <TabsTrigger value="teams" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Teams
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Results
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Questions Tab */}
        <TabsContent value="questions" className="space-y-4">
          {/* Add Default Into the Deep Questions */}
          <Card>
            <CardHeader>
              <CardTitle>Default Into the Deep Questions</CardTitle>
              <CardDescription>Pre-loaded questions for the 2024-25 FTC season</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={async () => {
                  const defaultQuestions = [
                    { text: "How many specimens did the team score in the high basket?", type: "number" },
                    { text: "How many specimens did the team score in the low basket?", type: "number" },
                    { text: "How many samples did the team score in the high basket?", type: "number" },
                    { text: "How many samples did the team score in the low basket?", type: "number" },
                    { text: "Did the team achieve level 1 ascent?", type: "boolean" },
                    { text: "Did the team achieve level 2 ascent?", type: "boolean" },
                    { text: "Did the team achieve level 3 ascent?", type: "boolean" },
                    {
                      text: "How would you rate the team's driving ability?",
                      type: "select",
                      options: ["Excellent", "Good", "Average", "Poor"],
                    },
                    {
                      text: "How would you rate the team's autonomous performance?",
                      type: "select",
                      options: ["Excellent", "Good", "Average", "Poor", "None"],
                    },
                    { text: "Additional notes about the team's performance", type: "text" },
                  ]

                  for (const q of defaultQuestions) {
                    await fetch("/api/scouting/questions", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        sessionId: session?.id,
                        questionText: q.text,
                        questionType: q.type,
                        options: q.options || null,
                      }),
                    })
                  }
                  fetchQuestions()
                  toast.success("Default questions added!")
                }}
                variant="outline"
                className="w-full"
              >
                Add Default Into the Deep Questions
              </Button>
            </CardContent>
          </Card>

          {/* Add Custom Question */}
          <Card>
            <CardHeader>
              <CardTitle>Add Custom Question</CardTitle>
              <CardDescription>Create additional questions for scouts to answer about teams</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="question-text">Question</Label>
                <Textarea
                  id="question-text"
                  placeholder="Enter your scouting question..."
                  value={newQuestion.text}
                  onChange={(e) => setNewQuestion((prev) => ({ ...prev, text: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="question-type">Question Type</Label>
                <Select
                  value={newQuestion.type}
                  onValueChange={(value: "text" | "number" | "boolean" | "select") =>
                    setNewQuestion((prev) => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Yes/No</SelectItem>
                    <SelectItem value="select">Multiple Choice</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newQuestion.type === "select" && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  {(newQuestion.options || []).map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChange={(e) => updateOption(index, e.target.value)}
                      />
                      {(newQuestion.options || []).length > 1 && (
                        <Button variant="outline" size="sm" onClick={() => removeOption(index)}>
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addOption}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                  </Button>
                </div>
              )}
              <Button onClick={addQuestion}>
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </Button>
            </CardContent>
          </Card>

          {/* Current Questions */}
          {(questions || []).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Current Questions ({(questions || []).length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(questions || []).map((question, index) => (
                    <div key={question.id} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium">
                            {index + 1}. {question.question_text}
                          </p>
                          <Badge variant="outline" className="mt-1">
                            {question.question_type}
                          </Badge>
                          {question.options && (
                            <div className="mt-2 text-sm text-gray-600">Options: {question.options.join(", ")}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Teams Tab */}
        <TabsContent value="teams">
          <Card>
            <CardHeader>
              <CardTitle>Registered Teams ({(teams || []).length})</CardTitle>
              <CardDescription>Teams available for scouting</CardDescription>
            </CardHeader>
            <CardContent>
              {(teams || []).length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <p className="text-gray-500">
                    No teams available. Make sure FTC API credentials are configured in your environment variables.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(teams || []).map((team) => (
                    <div key={team.id} className="p-4 border rounded-lg">
                      <div className="font-bold text-lg">#{team.team_number}</div>
                      <div className="font-medium">{team.team_name}</div>
                      <div className="text-sm text-gray-600">{team.school}</div>
                      <div className="text-sm text-gray-500">
                        {team.city}, {team.state}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle>Scouting Results</CardTitle>
              <CardDescription>{getAnsweredTeams().length} teams have been scouted</CardDescription>
            </CardHeader>
            <CardContent>
              {getAnsweredTeams().length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No scouting data yet. Share the session code with scouts to start collecting data.
                </p>
              ) : (
                <Accordion type="single" collapsible className="space-y-2">
                  {getAnsweredTeams().map((team) => {
                    const teamAnswers = getTeamAnswers(team.id)
                    return (
                      <AccordionItem key={team.id} value={team.id.toString()}>
                        <AccordionTrigger className="text-left">
                          <div>
                            <div className="font-bold">
                              #{team.team_number} - {team.team_name}
                            </div>
                            <div className="text-sm text-gray-600">{teamAnswers.length} responses</div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-3 pt-2">
                            {teamAnswers.map((answer, index) => (
                              <div
                                key={`${answer.question_id}-${answer.team_id}-${index}`}
                                className="border-l-4 border-blue-200 pl-4"
                              >
                                <div className="font-medium">{answer.question_text}</div>
                                <div className="text-lg">{answer.answer_value}</div>
                                <div className="text-sm text-gray-500">Scouted by: {answer.scout_name}</div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {analytics ? (
            <div className="space-y-6">
              {/* Export Options */}
              <Card>
                <CardHeader>
                  <CardTitle>Export Data</CardTitle>
                  <CardDescription>Download your scouting data in different formats</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button onClick={() => exportData("csv")} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button onClick={() => exportData("json")} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export JSON
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-gray-500">
                  No analytics data available yet. Start collecting scouting data to see insights.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
