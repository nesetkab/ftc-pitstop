"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Calendar, AlertCircle, Clock, MapPin, Hash, Monitor } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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
  const [eventSearchTerm, setEventSearchTerm] = useState("")
  const [teamSearchTerm, setTeamSearchTerm] = useState("")
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [loadingTeam, setLoadingTeam] = useState(false)
  const [eventError, setEventError] = useState<string | null>(null)
  const [teamError, setTeamError] = useState<string | null>(null)
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([])
  const [loadingUpcoming, setLoadingUpcoming] = useState(true)
  const [teamInfo, setTeamInfo] = useState<any>(null)
  const [teamEvents, setTeamEvents] = useState<Event[]>([])
  const [showMobileWarning, setShowMobileWarning] = useState(false)

  useEffect(() => {
    if (window.innerWidth < 768) {
      const dismissed = sessionStorage.getItem('mobile-warning-dismissed')
      if (!dismissed) setShowMobileWarning(true)
    }
  }, [])

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
    if (!eventSearchTerm.trim()) return
    setLoadingEvents(true)
    setEventError(null)
    try {
      const response = await fetch(`/api/events/search?q=${encodeURIComponent(eventSearchTerm)}`)
      const data = await response.json()
      if (!response.ok) {
        setEventError(data.error || "Search failed")
        return
      }
      setEvents(data.events || [])
      if (data.events?.length === 0) {
        setEventError(`No events found for "${eventSearchTerm}"`)
      }
    } catch {
      setEventError("Failed to search events.")
    } finally {
      setLoadingEvents(false)
    }
  }

  const searchTeam = async () => {
    if (!teamSearchTerm.trim()) return
    setLoadingTeam(true)
    setTeamError(null)
    setTeamInfo(null)
    setTeamEvents([])
    try {
      const response = await fetch(`/api/teams/search?q=${encodeURIComponent(teamSearchTerm.trim())}`)
      const data = await response.json()
      if (!response.ok) {
        setTeamError(data.error || "Search failed")
        return
      }
      setTeamInfo(data.teamInfo)
      setTeamEvents(data.events || [])
      if (!data.events || data.events.length === 0) {
        setTeamError(`No events found for team ${teamSearchTerm.trim()}`)
      }
    } catch {
      setTeamError("Failed to search for team.")
    } finally {
      setLoadingTeam(false)
    }
  }

  const handleEventSelect = (event: Event) => {
    localStorage.setItem("selectedEvent", JSON.stringify(event))
    window.location.href = `/event/${event.code}`
  }

  const handleDirectEventCode = () => {
    if (eventSearchTerm.trim()) {
      window.location.href = `/event/${eventSearchTerm.trim()}`
    }
  }

  const isEventLive = (event: Event) => {
    const now = new Date()
    return new Date(event.dateStart) <= now && new Date(event.dateEnd) >= now
  }

  const isEventSoon = (event: Event) => {
    const now = new Date()
    const daysUntil = Math.ceil((new Date(event.dateStart).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return daysUntil > 0 && daysUntil <= 14
  }

  const EventCard = ({ event, onClick }: { event: Event; onClick: () => void }) => {
    const live = isEventLive(event)
    const soon = isEventSoon(event)
    return (
      <div
        className={`p-3 rounded-lg border cursor-pointer transition-all hover:border-purple-500/50 ${live ? "border-red-500/70" : soon ? "border-purple-500/50" : ""
          }`}
        style={{ borderColor: live ? undefined : soon ? undefined : "var(--color-border)", backgroundColor: "var(--color-background-secondary)" }}
        onClick={onClick}
      >
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{event.code}</Badge>
          {live && (
            <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 animate-pulse">LIVE</Badge>
          )}
          {soon && !live && (
            <Badge variant="outline" className="border-purple-400 text-purple-400 text-[10px] px-1.5 py-0">
              <Clock className="h-2.5 w-2.5 mr-0.5" />Soon
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {new Date(event.dateStart).toLocaleDateString()}
          </span>
        </div>
        <div className="font-medium text-sm">{event.name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
          <MapPin className="h-2.5 w-2.5" />
          {event.city}, {event.stateprov}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-1">Find Your Event</h1>
        <p className="text-sm text-muted-foreground">Search for an event or look up a team to find their events</p>
      </div>

      {/* Side-by-side search */}
      <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-start mb-8">
        {/* Event Search */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-purple-500" />
              Search by Event
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Event name, location, or code"
                value={eventSearchTerm}
                onChange={(e) => setEventSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchEvents()}
                className="text-sm"
              />
              <Button size="sm" onClick={searchEvents} disabled={loadingEvents} className="bg-purple-600 hover:bg-purple-700">
                {loadingEvents ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleDirectEventCode} className="w-full" disabled={!eventSearchTerm.trim()}>
              Go to Event Code
            </Button>

            {eventError && (
              <div className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{eventError}
              </div>
            )}

            {events.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {events.map((event) => (
                  <EventCard key={event.code} event={event} onClick={() => handleEventSelect(event)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Divider */}
        <div className="hidden md:flex flex-col items-center justify-center self-center">
          <div className="w-px h-12 bg-border" />
          <span className="text-xs text-muted-foreground py-2 font-medium">or</span>
          <div className="w-px h-12 bg-border" />
        </div>
        <div className="md:hidden text-center text-xs text-muted-foreground py-1 font-medium">or</div>

        {/* Team Search */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Hash className="h-4 w-4 text-purple-500" />
              Search by Team
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Team number (e.g. 3747)"
                value={teamSearchTerm}
                onChange={(e) => setTeamSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchTeam()}
                type="number"
                className="text-sm"
              />
              <Button size="sm" onClick={searchTeam} disabled={loadingTeam} className="bg-purple-600 hover:bg-purple-700">
                {loadingTeam ? (
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                ) : (
                  <Search className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            {teamError && (
              <div className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />{teamError}
              </div>
            )}

            {teamInfo && (
              <div className="p-2 rounded-lg text-sm" style={{ backgroundColor: "var(--color-background-secondary)", borderColor: "var(--color-border)" }}>
                <span className="font-semibold">{teamInfo.teamNumber}</span> - {teamInfo.nameShort}
                {teamInfo.city && <span className="text-xs text-muted-foreground block">{teamInfo.city}{teamInfo.stateProv ? `, ${teamInfo.stateProv}` : ""}</span>}
              </div>
            )}

            {loadingTeam && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Searching events...</p>
              </div>
            )}

            {teamEvents.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                <p className="text-[10px] text-muted-foreground">Events (closest first):</p>
                {teamEvents.map((event) => (
                  <EventCard key={event.code} event={event} onClick={() => {
                    if (teamInfo?.teamNumber) {
                      localStorage.setItem("selectedTeam", JSON.stringify(teamInfo))
                      window.location.href = `/dashboard/${event.code}/${teamInfo.teamNumber}`
                    } else {
                      handleEventSelect(event)
                    }
                  }} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Events */}
      {!loadingUpcoming && upcomingEvents.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Upcoming & Current Events
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcomingEvents.map((event) => (
              <EventCard key={event.code} event={event} onClick={() => handleEventSelect(event)} />
            ))}
          </div>
        </div>
      )}

      {loadingUpcoming && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading upcoming events...</p>
        </div>
      )}

      <Dialog open={showMobileWarning} onOpenChange={(open) => {
        setShowMobileWarning(open)
        if (!open) sessionStorage.setItem('mobile-warning-dismissed', '1')
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Desktop Recommended
            </DialogTitle>
            <DialogDescription>
              Pitstop is designed for large screens. For the best experience, please use a computer or tablet.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => {
            setShowMobileWarning(false)
            sessionStorage.setItem('mobile-warning-dismissed', '1')
          }}>
            Continue Anyway
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
