
"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Plus, Copy, Check, Users, ClipboardList, BarChart3, Download, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface ScoutingManagerProps {
  sessionId?: string
  eventCode?: string
  managerName?: string
  onSessionCreate?: (sessionCode: string) => void
}

interface Event {
  id: number
  name: string
  location: string
  date: string
  code: string
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
  const { toast } = useToast()

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

  const [selectedEvent, setSelectedEvent] = useState(initialEventCode || "")
  const [managerName, setManagerName] = useState(initialManagerName || "")
  const [isCreatingSession, setIsCreatingSession] = useState(false)

  useEffect(() => {
    if (sessionId) {
      fetchSessionById(sessionId)
    } else {
      fetchEvents()
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (session) {
      fetchEvents()
      fetchTeamsForEvent(session.event_code || "")
      fetchQuestions()
      fetchAnswers()
      fetchConnectedScouts()
      fetchAnalytics()
    }
  }, [session])

  const fetchSessionById = async (sessionCode: string) => {
    try {
      const response = await fetch(`/api/scouting/sessions?code=${sessionCode}`)
      if (response.ok) {
        const sessionData = await response.json()
        setSession(sessionData)
      } else {
        toast({ title: "Error", description: "Session not found", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load session", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const createSession = async () => {
    if (!managerName.trim() || !selectedEvent) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" })
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
        toast({ title: "Success!", description: `Session created with code: ${data.session_code}` })
      } else {
        toast({ title: "Error", description: "Failed to create session", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to create session", variant: "destructive" })
    } finally {
      setIsCreatingSession(false)
    }
  }

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
      toast({ title: "Error", description: "Failed to fetch questions", variant: "destructive" })
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
      toast({ title: "Error", description: "Failed to fetch answers", variant: "destructive" })
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
    toast({ title: "Refreshed", description: "Data updated successfully" })
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

      toast({ title: "Exported", description: `Data exported as ${format.toUpperCase()}` })
    } catch (error) {
      toast({ title: "Error", description: "Failed to export data", variant: "destructive" })
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
        toast({ title: "Success", description: "Question added!" })
      } else {
        toast({ title: "Error", description: "Failed to add question", variant: "destructive" })
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to add question", variant: "destructive" })
    }
  }

  const copySessionCode = () => {
    if (session) {
      navigator.clipboard.writeText(session.session_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast({ title: "Copied!", description: "Session code copied to clipboard" })
    }
  }

  const copySessionUrl = () => {
    const url = `${window.location.origin}/scout/${session?.session_code}`
    navigator.clipboard.writeText(url)
    toast({ title: "Copied!", description: "Scout URL copied to clipboard" })
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
            <div className="space-y-2">
              <Label htmlFor="event-select">Select Event</Label>
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an event" />
                </SelectTrigger>
                <SelectContent>
                  {(events || []).length === 0 ? (
                    <SelectItem value="no-events" disabled>
                      No events available - Configure FTC API credentials
                    </SelectItem>
                  ) : (
                    (events || []).map((event) => (
                      <SelectItem key={event.id} value={event.code}>
                        {event.name} - {event.location}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
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
                  toast({ title: "Success", description: "Default questions added!" })
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
                  onValueChange={(value: any) => setNewQuestion((prev) => ({ ...prev, type: value }))}
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
                            {teamAnswers.map((answer) => (
                              <div
                                key={`${answer.question_id}-${answer.team_id}`}
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
