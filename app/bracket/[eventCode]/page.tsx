"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, RefreshCw, AlertCircle } from "lucide-react"
import Link from "next/link"
import { FullTournamentBracket } from "@/components/full-tournament-bracket"

interface Match {
  matchNumber: number
  description: string
  startTime: string
  red1: number
  red2: number
  blue1: number
  blue2: number
  redScore: number
  blueScore: number
  played: boolean
  tournamentLevel: string
  series?: number
  matchInSeries?: number
}

interface Alliance {
  number: number
  captain: number
  round1: number
  round2: number
  backup?: number
  name?: string
}

interface Event {
  code: string
  name: string
  start: string
  end: string
  venue: string
}

export default function BracketPage() {
  const params = useParams()
  const eventCode = params.eventCode as string

  const [matches, setMatches] = useState<Match[]>([])
  const [alliances, setAlliances] = useState<Alliance[]>([])
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchData = async () => {
    try {
      setError(null)
      console.log("Fetching bracket data for event", eventCode)

      const [eventResponse, matchesResponse, alliancesResponse] = await Promise.all([
        fetch(`/api/events/${eventCode}`),
        fetch(`/api/events/${eventCode}/matches`),
        fetch(`/api/events/${eventCode}/alliances`),
      ])

      console.log("API Response statuses:", {
        event: eventResponse.status,
        matches: matchesResponse.status,
        alliances: alliancesResponse.status,
      })

      let eventData = { event: null }
      let matchesData = { matches: [] }
      let alliancesData = { alliances: [] }

      if (eventResponse.ok) {
        eventData = await eventResponse.json()
      } else {
        console.error("Event API failed:", await eventResponse.text())
      }

      if (matchesResponse.ok) {
        matchesData = await matchesResponse.json()
      } else {
        console.error("Matches API failed:", await matchesResponse.text())
        setError("Unable to load match data.")
      }

      if (alliancesResponse.ok) {
        alliancesData = await alliancesResponse.json()
      } else {
        console.error("Alliances API failed:", await alliancesResponse.text())
      }

      setEvent(eventData.event)
      setMatches(matchesData.matches || [])
      setAlliances(alliancesData.alliances || [])
      setLastUpdate(new Date())

      console.log("Bracket data loaded successfully")
    } catch (error) {
      console.error("Error fetching bracket data:", error)
      setError("Failed to load bracket data. Please check your connection.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [eventCode])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading tournament bracket...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Link href={`/event/${eventCode}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Event
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Tournament Bracket</h1>
              <p className="text-muted-foreground">
                {event?.name || eventCode} • {event?.venue}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <p className="text-xs text-muted-foreground">Last updated: {lastUpdate.toLocaleTimeString()}</p>
          </div>
        </div>

        {error && (
          <Card className="mb-6 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div className="flex-1">
                  <p className="text-yellow-900 dark:text-yellow-100">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <FullTournamentBracket matches={matches} alliances={alliances} eventName={event?.name} />
      </div>
    </div>
  )
}
