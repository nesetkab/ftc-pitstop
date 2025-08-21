"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeft, Send, Smartphone, Users, CheckCircle } from "lucide-react"
import { toast } from "sonner"

interface ScoutingSession {
  id: number
  session_code: string
  event_id: number
  manager_name: string
  is_active: boolean
  event_code: string // Added event_code to ScoutingSession interface
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
  questionId: number
  value: string
}

type Step = "connect" | "session-list" | "team-select" | "scouting" | "complete"

export default function ScoutingClient() {
  const [step, setStep] = useState<Step>("connect")
  const [sessionCode, setSessionCode] = useState("")
  const [scoutName, setScoutName] = useState("")
  const [session, setSession] = useState<ScoutingSession | null>(null)
  const [activeSessions, setActiveSessions] = useState<ScoutingSession[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Load session from localStorage on page load
    const savedSession = localStorage.getItem("ftc-scout-session")
    const savedScoutName = localStorage.getItem("ftc-scout-name")
    const savedTeam = localStorage.getItem("ftc-scout-team")
    const savedStep = localStorage.getItem("ftc-scout-step")

    if (savedSession && savedScoutName) {
      try {
        const sessionData = JSON.parse(savedSession)
        const teamData = savedTeam ? JSON.parse(savedTeam) : null

        setSession(sessionData)
        setScoutName(savedScoutName)
        if (teamData) {
          setSelectedTeam(teamData)
        }
        if (savedStep) {
          setStep(savedStep as Step)
        } else if (teamData) {
          setStep("scouting")
        } else {
          setStep("team-select")
        }
      } catch (error) {
        console.error("Failed to restore scout session from localStorage:", error)
        localStorage.removeItem("ftc-scout-session")
        localStorage.removeItem("ftc-scout-name")
        localStorage.removeItem("ftc-scout-team")
        localStorage.removeItem("ftc-scout-step")
      }
    }
  }, [])

  useEffect(() => {
    if (session) {
      fetchTeams()
      fetchQuestions()
    }
  }, [session])

  useEffect(() => {
    if (questions.length > 0) {
      setAnswers(questions.map((q) => ({ questionId: q.id, value: "" })))
    }
  }, [questions])

  useEffect(() => {
    if (session && scoutName) {
      localStorage.setItem("ftc-scout-session", JSON.stringify(session))
      localStorage.setItem("ftc-scout-name", scoutName)
      localStorage.setItem("ftc-scout-step", step)
    }
  }, [session, scoutName, step])

  useEffect(() => {
    if (selectedTeam) {
      localStorage.setItem("ftc-scout-team", JSON.stringify(selectedTeam))
    } else {
      localStorage.removeItem("ftc-scout-team")
    }
  }, [selectedTeam])

  const fetchTeams = async () => {
    if (!session) return

    try {
      console.log("📡 Fetching teams for event:", session.event_code)
      const response = await fetch(`/api/teams?eventCode=${session.event_code}`)
      if (response.ok) {
        const data = await response.json()
        console.log("📡 Teams data received:", data)
        setTeams(Array.isArray(data) ? data : [])
      } else {
        console.error("❌ Teams API error:", response.status)
        setTeams([])
        toast.warning("Warning", { description: "Failed to fetch teams" })
      }
    } catch (error) {
      console.error("❌ Teams fetch error:", error)
      setTeams([])
      toast.error("Error", { description: "Failed to fetch teams" })
    }
  }

  const fetchQuestions = async () => {
    if (!session) return
    try {
      console.log("📡 Fetching questions for session:", session.id)
      const response = await fetch(`/api/questions?sessionId=${session.id}`)
      if (response.ok) {
        const data = await response.json()
        console.log("📡 Questions data received:", data)
        setQuestions(Array.isArray(data) ? data : [])
      } else {
        console.error("❌ Questions API error:", response.status)
        setQuestions([])
      }
    } catch (error) {
      console.error("❌ Questions fetch error:", error)
      setQuestions([])
      toast.error("Error", { description: "Failed to fetch questions" })
    }
  }

  const connectToSession = async () => {
    console.log("🔗 Connect button clicked!")
    console.log("📝 Session code:", sessionCode, "Scout name:", scoutName)

    if (!sessionCode.trim() || !scoutName.trim()) {
      console.log("❌ Validation failed - missing session code or name")
      toast.error("Error", { description: "Please enter both session code and your name" })
      return
    }

    try {
      console.log("📡 Attempting to connect to session:", sessionCode.toUpperCase())
      const response = await fetch(`/api/sessions?code=${sessionCode.toUpperCase()}`)
      console.log("📡 Session response status:", response.status)

      if (response.ok) {
        const sessionData = await response.json()
        console.log("📡 Session data received:", sessionData)

        router.push(`/scout/${sessionData.session_code}`)
      } else {
        const errorText = await response.text()
        toast.error("Error", { description: "Invalid session code" })

        console.log("❌ Session lookup failed:", response.status, errorText)
      }
    } catch (error) {
      console.error("❌ Connection error:", error)
      toast.error("Error", { description: "Failed to connect to session" })
    }
  }

  const selectTeam = (team: Team) => {
    setSelectedTeam(team)
    setStep("scouting")
  }

  const updateAnswer = (questionId: number, value: string) => {
    setAnswers((prev) => prev.map((answer) => (answer.questionId === questionId ? { ...answer, value } : answer)))
  }

  const getCurrentAnswer = (questionId: number) => {
    return answers.find((a) => a.questionId === questionId)?.value || ""
  }

  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const submitAnswers = async () => {
    if (!session || !selectedTeam) return

    setIsSubmitting(true)
    try {
      for (const answer of answers) {
        if (answer.value.trim()) {
          await fetch("/api/answers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: session.id,
              teamId: selectedTeam.id,
              questionId: answer.questionId,
              answerValue: answer.value,
              scoutName: scoutName,
            }),
          })
        }
      }

      setStep("complete")
      toast.success("Success!", { description: "Your scouting data has been submitted" })
    } catch (error) {
      toast.error("Error", { description: "Failed to submit answers" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const startNewScouting = () => {
    setSelectedTeam(null)
    setCurrentQuestionIndex(0)
    setAnswers(questions.map((q) => ({ questionId: q.id, value: "" })))
    setStep("team-select")
  }

  const clearSession = () => {
    setSession(null)
    setScoutName("")
    setSelectedTeam(null)
    setStep("connect")
    setSessionCode("")
    setActiveSessions([])
    setTeams([])
    setQuestions([])
    setAnswers([])
    setCurrentQuestionIndex(0)
    localStorage.removeItem("ftc-scout-session")
    localStorage.removeItem("ftc-scout-name")
    localStorage.removeItem("ftc-scout-team")
    localStorage.removeItem("ftc-scout-step")
    toast.info("Session Cleared", { description: "Disconnected from session" })
  }

  const renderQuestion = (question: Question) => {
    const currentValue = getCurrentAnswer(question.id)

    switch (question.question_type) {
      case "text":
        return (
          <Textarea
            placeholder="Enter your answer..."
            value={currentValue}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className="min-h-[100px] text-lg"
          />
        )

      case "number":
        return (
          <Input
            type="number"
            placeholder="Enter a number..."
            value={currentValue}
            onChange={(e) => updateAnswer(question.id, e.target.value)}
            className="text-lg text-center"
          />
        )

      case "boolean":
        return (
          <RadioGroup value={currentValue} onValueChange={(value) => updateAnswer(question.id, value)}>
            <div className="flex items-center space-x-2 p-4 border rounded-lg">
              <RadioGroupItem value="Yes" id="yes" />
              <Label htmlFor="yes" className="text-lg font-medium cursor-pointer flex-1">
                Yes
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-4 border rounded-lg">
              <RadioGroupItem value="No" id="no" />
              <Label htmlFor="no" className="text-lg font-medium cursor-pointer flex-1">
                No
              </Label>
            </div>
          </RadioGroup>
        )

      case "select":
        return (
          <RadioGroup value={currentValue} onValueChange={(value) => updateAnswer(question.id, value)}>
            {question.options &&
              Array.isArray(question.options) &&
              question.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2 p-4 border rounded-lg">
                  <RadioGroupItem value={option} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="text-lg font-medium cursor-pointer flex-1">
                    {option}
                  </Label>
                </div>
              ))}
          </RadioGroup>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Smartphone className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-white">scouter client</h1>
            {session && (
              <Button variant="ghost" size="sm" onClick={clearSession} className="ml-2">
                Disconnect
              </Button>
            )}
          </div>
          <p className="text-gray-600">Mobile scouting client</p>
        </div>

        {/* Connect Step */}
        {step === "connect" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Connect to Session
              </CardTitle>
              <CardDescription>Enter your name and session code</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scout-name">Your Name</Label>
                <Input
                  id="scout-name"
                  placeholder="Enter your name"
                  value={scoutName}
                  onChange={(e) => setScoutName(e.target.value)}
                  className="text-lg"
                />
              </div>



              <div className="space-y-2">
                <Label htmlFor="session-code">Session Code</Label>
                <Input
                  id="session-code"
                  placeholder="Enter 6-character code"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="text-lg text-center font-mono tracking-wider"
                />
              </div>
              <Button
                onClick={connectToSession}
                className="w-full text-lg py-6"
                disabled={!scoutName.trim() || !sessionCode.trim()}
              >
                Connect to Session
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Team Selection Step */}
        {step === "team-select" && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Select Team to Scout</CardTitle>
                <CardDescription>Choose which team you want to scout</CardDescription>
              </CardHeader>
            </Card>

            <div className="space-y-3">
              {!teams || teams.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <p className="text-gray-500">
                      {teams === null ? "Loading teams..." : "No teams available for this event"}
                    </p>
                    {teams !== null && teams.length === 0 && (
                      <p className="text-sm text-gray-400 mt-2">Make sure FTC API credentials are configured</p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                teams.map((team) => (
                  <Card key={team.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4" onClick={() => selectTeam(team)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-lg">#{team.team_number}</div>
                          <div className="font-medium text-blue-600">{team.team_name}</div>
                          <div className="text-sm text-gray-600">{team.school}</div>
                          <div className="text-sm text-gray-500">
                            {team.city}, {team.state}
                          </div>
                        </div>
                        <div className="text-blue-500">
                          <ArrowLeft className="h-5 w-5 rotate-180" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {/* Scouting Step */}
        {step === "scouting" && selectedTeam && questions && questions.length > 0 && (
          <div className="space-y-4">
            {/* Progress Header */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setStep("team-select")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Badge variant="secondary">
                    {currentQuestionIndex + 1} of {questions.length}
                  </Badge>
                </div>
                <CardTitle className="text-center">
                  #{selectedTeam.team_number} - {selectedTeam.team_name}
                </CardTitle>
              </CardHeader>
            </Card>

            {/* Current Question */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg leading-relaxed">
                  {questions[currentQuestionIndex]?.question_text || "Loading question..."}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions[currentQuestionIndex] && renderQuestion(questions[currentQuestionIndex])}
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={goToPreviousQuestion}
                disabled={currentQuestionIndex === 0}
                className="flex-1 py-6 bg-transparent"
              >
                Previous
              </Button>
              {currentQuestionIndex === questions.length - 1 ? (
                <Button onClick={submitAnswers} disabled={isSubmitting} className="flex-1 py-6">
                  {isSubmitting ? (
                    "Submitting..."
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Submit
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={goToNextQuestion} className="flex-1 py-6">
                  Next
                </Button>
              )}
            </div>

            {/* Progress Dots */}
            <div className="flex justify-center gap-2 py-2">
              {questions &&
                questions.map((_, index) => (
                  <div
                    key={index}
                    className={`w-3 h-3 rounded-full ${index === currentQuestionIndex
                      ? "bg-blue-500"
                      : getCurrentAnswer(questions[index].id)
                        ? "bg-green-500"
                        : "bg-gray-300"
                      }`}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Complete Step */}
        {step === "complete" && (
          <Card>
            <CardContent className="text-center py-8 space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Scouting Complete!</h2>
                <p className="text-gray-600 mt-2">
                  Your data for #{selectedTeam?.team_number} has been submitted successfully.
                </p>
              </div>
              <div className="space-y-3 pt-4">
                <Button onClick={startNewScouting} className="w-full py-6">
                  Scout Another Team
                </Button>
                <Button variant="outline" onClick={() => setStep("connect")} className="w-full">
                  Join Different Session
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Session Info Footer */}
        {session && (
          <div className="text-center text-sm text-gray-500">
            Connected to {session.manager_name}'s session
            <br />
            <Badge variant="outline" className="mt-1">
              {session.session_code}
            </Badge>
          </div>
        )}
      </div>
    </div>
  )
}
