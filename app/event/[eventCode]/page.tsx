"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Users, Search } from "lucide-react"
import Link from "next/link"

interface Team {
  teamNumber: number
  teamName: string
  schoolName: string
  city: string
  stateProv: string
  country: string
}

interface Event {
  code: string
  name: string
  dateStart: string
  dateEnd: string
  venue: string
}

export default function EventPage() {
  const params = useParams()
  const eventCode = params.eventCode as string
  const [teams, setTeams] = useState<Team[]>([])
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const [eventResponse, teamsResponse] = await Promise.all([
          fetch(`/api/events/${eventCode}`),
          fetch(`/api/events/${eventCode}/teams`),
        ])

        const eventData = await eventResponse.json()
        const teamsData = await teamsResponse.json()

        setEvent(eventData.event)
        setTeams(teamsData.teams || [])
      } catch (error) {
        console.error("Error fetching event data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchEventData()
  }, [eventCode])

  const filteredTeams = teams.filter(
    (team) =>
      team.teamNumber.toString().includes(searchTerm) ||
      (team.teamName?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (team.schoolName?.toLowerCase() || "").includes(searchTerm.toLowerCase()),
  )

  const handleTeamSelect = (team: Team) => {
    localStorage.setItem("selectedTeam", JSON.stringify(team))
    window.location.href = `/dashboard/${eventCode}/${team.teamNumber}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading event data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href="/">
            <Button variant="outline" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Events
            </Button>
          </Link>

          {event && (
            <div className="mb-6">
              <Badge variant="secondary" className="mb-2">
                {event.code}
              </Badge>
              <h1 className="text-3xl font-bold mb-2">{event.name}</h1>
              <p className="text-muted-foreground">
                {new Date(event.dateStart).toLocaleDateString()} - {new Date(event.dateEnd).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Select Your Team
            </CardTitle>
            <CardDescription>Choose your team to access the personalized pit display dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by team number, name, or school..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid gap-3 max-h-96 overflow-y-auto">
              {filteredTeams.map((team) => (
                <Card
                  key={team.teamNumber}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleTeamSelect(team)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">#{team.teamNumber}</Badge>
                          <span className="font-semibold">{team.teamName}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{team.schoolName}</p>
                        <p className="text-xs text-muted-foreground">
                          {team.city}, {team.stateProv}, {team.country}
                        </p>
                      </div>
                      <div className="text-right">
                        <Button variant="ghost" size="sm">
                          Select Team
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredTeams.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "No teams found matching your search." : "No teams found for this event."}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
