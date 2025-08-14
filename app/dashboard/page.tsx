"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Calendar, Trophy, Users, AlertCircle, TestTube, Clock, MapPin } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface Event {
  code: string
  name: string
  dateStart: string
  dateEnd: string
  venue: string
  city: string
  stateprov: string
  country: string
}

export default function DashboardPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [loadingUpcoming, setLoadingUpcoming] = useState(true)

  useEffect(() => {
    const loadUpcomingEvents = async () => {
      try {
        setLoadingUpcoming(true)
        const response = await fetch("/api/events/upcoming")
        const data = await response.json()
        if (data.success && data.events) {
          setUpcomingEvents(data.events.slice(0, 6))
        }
      } catch (error) {
        console.log("Could not load upcoming events:", error)
      } finally {
        setLoadingUpcoming(false)
      }
    }
    loadUpcomingEvents()
  }, [])

  const searchEvents = async () => {
    if (!searchTerm.trim()) return

    setLoading(true)
    setError(null)
    setDebugInfo(null)

    try {
      console.log("Searching for:", searchTerm)
      const response = await fetch(`/api/events/search?q=${encodeURIComponent(searchTerm)}`)
      const data = await response.json()

      console.log("Response status:", response.status)
      console.log("Response data:", data)

      if (!response.ok) {
        console.error("Search error:", data)
        setError(`Error: ${data.error}${data.details ? ` - ${data.details}` : ""}`)
        return
      }

      console.log("Search results:", data.events?.length || 0, "events")
      setEvents(data.events || [])
      setDebugInfo({
        totalEvents: data.totalEvents,
        searchQuery: data.searchQuery,
        foundEvents: data.events?.length || 0,
      })

      if (data.events?.length === 0) {
        setError(
          `No events found matching "${searchTerm}". Try searching for event names like "Championship" or "League Meet".`,
        )
      }
    } catch (error) {
      console.error("Error searching events:", error)
      setError("Failed to search events. Please check your internet connection and API credentials.")
    } finally {
      setLoading(false)
    }
  }

  const handleEventSelect = (event: Event) => {
    localStorage.setItem("selectedEvent", JSON.stringify(event))
    window.location.href = `/event/${event.code}`
  }

  const handleDirectEventCode = () => {
    if (searchTerm.trim()) {
      window.location.href = `/event/${searchTerm.trim()}`
    }
  }

  const quickTestEvent = (eventCode: string) => {
    window.location.href = `/event/${eventCode}`
  }

  const isEventUpcoming = (event: Event) => {
    const now = new Date()
    const eventStart = new Date(event.dateStart)
    const eventEnd = new Date(event.dateEnd)
    return eventStart <= now && eventEnd >= now
  }

  const isEventSoon = (event: Event) => {
    const now = new Date()
    const eventStart = new Date(event.dateStart)
    const daysUntil = Math.ceil((eventStart.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntil > 0 && daysUntil <= 14
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Find Your Event
          </CardTitle>
          <CardDescription>
            Search for your FTC event by name, location, or enter the event code directly...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">

            <Input
              placeholder="Try: Championship, League Meet, or event code"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchEvents()}
              className="flex-1"
            />
            <Button onClick={searchEvents} disabled={loading}>
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDirectEventCode}
              className="flex-1"
              disabled={!searchTerm.trim()}
            >
              Go to Event Code
            </Button>
          </div>

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}

          {debugInfo && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="text-xs text-blue-800 dark:text-blue-200">
                <p>
                  Search: "{debugInfo.searchQuery}" | Total Events: {debugInfo.totalEvents} | Found:{" "}
                  {debugInfo.foundEvents}
                </p>
              </div>
            </div>
          )}

          {events.length > 0 && (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <h3 className="font-semibold text-sm text-muted-foreground">Search Results:</h3>
              {events.map((event) => (
                <Card
                  key={event.code}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleEventSelect(event)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary">{event.code}</Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(event.dateStart).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="font-semibold">{event.name}</h4>
                        <p className="text-sm text-muted-foreground">
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

          {!loading && !error && events.length === 0 && searchTerm && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Try searching for:</p>
              <ul className="mt-2 text-sm">
                <li>• "Championship" for championship events</li>
                <li>• "League Meet" for league tournaments</li>
                <li>• Your state name (e.g., "Washington", "California")</li>
                <li>• Specific event codes if you know them</li>
              </ul>
            </div>
          )}

          {/* Upcoming Events */}
          {!loadingUpcoming && upcomingEvents.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Upcoming & Current Events
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {upcomingEvents.map((event) => {
                  const isLive = isEventUpcoming(event)
                  const isSoon = isEventSoon(event)
                  const eventStart = new Date(event.dateStart)
                  const eventEnd = new Date(event.dateEnd)

                  return (
                    <Card
                      key={event.code}
                      className={`cursor-pointer hover:shadow-md transition-all ${isLive
                        ? "border-red-500 dark:border-red-300 hover:border-red-100 dark:hover:border-red-900 bg-white dark:bg-black shadow-md"
                        : isSoon
                          ? "border-purple-500 dark:border-purple-300 hover:border-purple-100 dark:hover:border-purple-900 bg-white dark:bg-black"
                          : "hover:border-gray-300"
                        }`}
                      onClick={() => quickTestEvent(event.code)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="secondary" className="font-mono">
                                {event.code}
                              </Badge>
                              {isLive && (
                                <Badge variant="default" className="bg-red-500 text-white animate-pulse">
                                  <div className="w-2 h-2 bg-white rounded-full mr-1"></div>
                                  LIVE
                                </Badge>
                              )}
                              {isSoon && !isLive && (
                                <Badge variant="outline" className="border-purple-400 text-purple-600">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Soon
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-semibold text-sm mb-1">{event.name}</h4>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                              <MapPin className="h-3 w-3" />
                              <span>
                                {event.venue} • {event.city}, {event.stateprov}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {isLive
                                ? `Ends ${eventEnd.toLocaleDateString()}`
                                : `${eventStart.toLocaleDateString()} - ${eventEnd.toLocaleDateString()}`}
                            </div>
                          </div>
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {loadingUpcoming && (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading upcoming events...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>

  )
}
