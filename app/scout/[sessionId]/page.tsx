"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ArrowLeft, Send, Smartphone, CheckCircle } from "lucide-react"
import { toast } from "sonner"

interface ScoutingSession {
  id: number
  session_code: string
  event_id: number
  manager_name: string
  is_active: boolean
  event_code: string
}

interface Team {
  teamNumber: number
  nameShort: string
  nameFull: string
  displayLocation: string
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

type Step = "connect" | "team-select" | "scouting" | "complete"

export default function ScoutSession() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const [step, setStep] = useState<Step>("connect")
  const [scoutName, setScoutName] = useState("")
  const [session, setSession] = useState<ScoutingSession | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (sessionId) {
      fetchSessionByCode(sessionId)
    }
  }, [sessionId])

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

  const fetchSessionByCode = async (code: string) => {
    try {
      const response = await fetch(`/api/scouting/sessions?code=${code.toUpperCase()}`)
      if (response.ok) {
        const sessionData = await response.json()
        setSession(sessionData)
        setStep("connect")
      } else {
        toast.error("Session not found")
        router.push("/scout")
      }
    } catch (error) {
      toast.error("Failed to load session")
      router.push("/scout")
    } finally {
      setLoading(false)
    }
  }
  const fetchTeams = async () => {
    if (!session) return
    try {
      const response = await fetch(`/api/events/${session.event_code}/teams`)
      if (response.ok) {
        const data = await response.json()
        setTeams(data.teams || [])
      } else {
        const errorText = await response.text()
        console.error(`API Error: ${response.status} - ${errorText}`)
      }
    } catch (error) {
      console.error("Failed to fetch teams:", error)
    }
  }


  const fetchQuestions = async () => {
    if (!session) return
    try {
      const response = await fetch(`/api/scouting/questions?sessionId=${session.id}`)
      if (response.ok) {
        const data = await response.json()
        setQuestions(Array.isArray(data) ? data : [])
      } else {
        setQuestions([])
      }
    } catch (error) {
      setQuestions([])
      toast.error("Failed to fetch questions")
    }
  }

  const joinSession = async () => {
    if (!scoutName.trim() || !session) {
      toast.error("Please enter your name")
      return
    }

    try {
      const scoutResponse = await fetch("/api/scouting/scouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionCode: session.session_code, scoutName }),
      })

      if (scoutResponse.ok) {
        setStep("team-select")
        toast.success("Connected!", { description: `Connected to ${session.manager_name}'s session` })
      } else {
        toast.error("Failed to join session")
      }
    } catch (error) {
      toast.error("Failed to join session")
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
          await fetch("/api/scouting/answers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: session.id,
              teamId: selectedTeam.teamNumber,
              questionId: answer.questionId,
              answerValue: answer.value,
              scoutName: scoutName,
            }),
          })
        }
      }

      setStep("complete")
      toast.success("Your scouting data has been submitted")
    } catch (error) {
      toast.error("Failed to submit answers")
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

  if (loading) {
    return (
      <div className="min-h-screen bg-current p-4 flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-lg">Loading session...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-current p-4 flex items-center justify-center">
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <div className="text-lg">Session not found</div>
            <Button onClick={() => router.push("/scout")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Scout
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-current p-4">
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Smartphone className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">FTC Scout</h1>
            <Button variant="ghost" size="sm" onClick={() => router.push("/scout")} className="ml-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>
          <p className="text-gray-600">Mobile scouting client</p>
        </div>

        {/* Connect Step */}
        {step === "connect" && (
          <Card>
            <CardHeader>
              <CardTitle>Join Session</CardTitle>
              <CardDescription>
                Session: {session.session_code} - {session.manager_name}
              </CardDescription>
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
              <Button onClick={joinSession} className="w-full text-lg py-6" disabled={!scoutName.trim()}>
                Join Session
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
                  <Card key={team.teamNumber} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardContent className="p-4" onClick={() => selectTeam(team)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-lg">#{team.teamNumber}</div>
                          <div className="font-medium text-blue-600">{team.nameShort}</div>
                          <div className="text-sm text-gray-600">{team.nameFull}</div>
                          <div className="text-sm text-gray-500">
                            {team.displayLocation}
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
                  #{selectedTeam.teamNumber} - {selectedTeam.nameShort}
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
                  Your data for #{selectedTeam?.teamNumber} has been submitted successfully.
                </p>
              </div>
              <div className="space-y-3 pt-4">
                <Button onClick={startNewScouting} className="w-full py-6">
                  Scout Another Team
                </Button>
                <Button variant="outline" onClick={() => router.push("/scout")} className="w-full">
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
