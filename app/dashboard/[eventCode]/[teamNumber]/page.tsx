"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  Bell,
  RefreshCw,
  AlertCircle,
  Settings,
  Monitor,
  ClipboardPen,
} from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import * as React from "react"
import { useSearchParams, useRouter } from 'next/navigation'
import { ThemeSettingsDialog } from "@/components/theme-settings-dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { GeneralTab } from "@/components/dashboard-tabs/general-tab"
import { WatchTab } from "@/components/dashboard-tabs/watch-tab"
import { TeamStatsTab } from "@/components/dashboard-tabs/team-stats-tab"
import { EventStatsTab } from "@/components/dashboard-tabs/event-stats-tab"
import { RankingsScheduleTab } from "@/components/dashboard-tabs/rankings-schedule-tab"
import { PlayoffsTab } from "@/components/dashboard-tabs/playoffs-tab"
import { LoadingProgress } from "@/components/loading-progress"
import { MatchDetailDialog } from "@/components/match-detail-dialog"

interface TeamData {
  teamNumber: number;
  displayTeamNumber: string;
  nameFull: string;
  nameShort: string;
  schoolName: string | null;
  city: string;
  stateProv: string;
  country: string;
  website: string | null;
  rookieYear: number;
  robotName: string | null;
  districtCode: string | null;
  homeCMP: string | null;
  homeRegion: string;
  displayLocation: string;
}

export interface TeamStats {
  wins: number
  losses: number
  ties: number
  opr: number
  dpr: number
  autoOpr?: number
  teleopOpr?: number
  endgameOpr?: number
  rank: number
  rp: number
  tbp: number
}

export interface Match {
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

export interface Ranking {
  teamNumber: number
  teamName?: string
  rank: number
  team: number
  rp: number
  tbp: number
  wins: number
  losses: number
  ties: number
}

export interface Alliance {
  number: number
  captain: number
  captainDisplay?: string
  round1: number
  round1Display?: string
  round2: number
  round2Display?: string
  round3?: number
  backup?: number
  name?: string
}

export default function DashboardPage() {
  const router = useRouter()
  const params = useParams()
  const eventCode = params.eventCode as string
  const teamNumber = Number.parseInt(params.teamNumber as string)
  const searchParams = useSearchParams()
  const currentTab = searchParams.get('tab') || 'general'

  const [teamStats, setTeamStats] = useState<TeamStats | null>(null)
  const [rankings, setRankings] = useState<Ranking[]>([])
  const [alliances, setAlliances] = useState<Alliance[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingStep, setLoadingStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [nextMatch, setNextMatch] = useState<Match | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [teamNames, setTeamNames] = useState<{ [key: number]: string }>({})
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [matchDialogOpen, setMatchDialogOpen] = useState(false)

  const loadingSteps = [
    "Connecting to server...",
    "Loading team statistics...",
    "Loading match schedule...",
    "Loading rankings...",
    "Loading alliance selections...",
    "Finalizing dashboard..."
  ]


  useEffect(() => {
    const storedDataString = localStorage.getItem('selectedTeam');

    if (storedDataString) {
      try {
        const storedDataObject: TeamData = JSON.parse(storedDataString);

        if (storedDataObject && storedDataObject.nameShort) {
          setTeamName(storedDataObject.nameShort);
        }
      } catch (error) {
        console.error("Failed to parse team data from local storage:", error);
      }
    }
  }, []);



  const getRelativeTime = (date: Date): string => {
    const now = new Date();
    // Difference in seconds
    const diffSeconds = (date.getTime() - now.getTime()) / 1000;

    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

    // Define time units in seconds
    const units: { [key: string]: number } = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1
    };

    for (const unit in units) {
      if (Math.abs(diffSeconds) > units[unit]) {
        const value = Math.round(diffSeconds / units[unit]);
        return rtf.format(value, unit as Intl.RelativeTimeFormatUnit);
      }
    }
    return rtf.format(Math.round(diffSeconds), 'second');
  };

  interface TimeAgoProps {
    lastUpdate: Date;
  }

  const TimeAgoDisplay: React.FC<TimeAgoProps> = ({ lastUpdate }) => {
    const [timeAgo, setTimeAgo] = useState<string>('');

    useEffect(() => {
      // Don't run if the date is not set yet
      if (!lastUpdate) return;

      // Set the initial value immediately on mount
      setTimeAgo(getRelativeTime(lastUpdate));

      // Set up an interval to update the time every 5 seconds
      const intervalId = setInterval(() => {
        setTimeAgo(getRelativeTime(lastUpdate));
      }, 1000); // 1000 ms = 1 second

      // This is the cleanup function.
      // React runs this when the component unmounts or `lastUpdate` changes.
      return () => {
        clearInterval(intervalId);
      };
    }, [lastUpdate]); // Rerun the effect if lastUpdate ever changes

    if (!lastUpdate) {
      return null; // Or return a loading/placeholder state
    }

    return (
      <span>{timeAgo}</span>
    );
  };

  const [showIntervalModal, setShowIntervalModal] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30000); // default 30s
  const [pendingInterval, setPendingInterval] = useState<number>(30000);
  const [showThemeDialog, setShowThemeDialog] = useState(false);

  const fetchData = async () => {
    try {
      setError(null)
      setLoadingStep(0)
      console.log("Fetching dashboard data for team", teamNumber, "at event", eventCode)

      setLoadingStep(1) // Loading team statistics
      // Fetch all data in parallel for speed
      const [statsResponse, matchesResponse, rankingsResponse, alliancesResponse, teamsResponse] = await Promise.all([
        fetch(`/api/teams/${teamNumber}/stats/${eventCode}`),
        fetch(`/api/events/${eventCode}/matches?team=${teamNumber}`),
        fetch(`/api/events/${eventCode}/rankings`),
        fetch(`/api/events/${eventCode}/alliances`),
        fetch(`/api/events/${eventCode}/teams`),
      ])
      setLoadingStep(4) // Loading alliance selections

      console.log("API Response statuses:", {
        stats: statsResponse.status,
        matches: matchesResponse.status,
        rankings: rankingsResponse.status,
        alliances: alliancesResponse.status,
        teams: teamsResponse.status,
      })

      // Handle each response individually to avoid failing everything if one fails
      let statsData = { stats: null }
      let matchesData = { matches: [] }
      let rankingsData = { rankings: [] }
      let alliancesData = { alliances: [] }
      let teamsData = { teams: [] as any[] }

      if (statsResponse.ok) {
        statsData = await statsResponse.json()
      } else {
        console.error("Stats API failed:", await statsResponse.text())
      }

      if (matchesResponse.ok) {
        matchesData = await matchesResponse.json()
      } else {
        console.error("Matches API failed:", await matchesResponse.text())
        setError("Unable to load match data. The event may not have started yet.")
      }

      if (rankingsResponse.ok) {
        rankingsData = await rankingsResponse.json()
      } else {
        console.error("Rankings API failed:", await rankingsResponse.text())
      }

      if (alliancesResponse.ok) {
        alliancesData = await alliancesResponse.json()
      } else {
        console.error("Alliances API failed:", await alliancesResponse.text())
      }

      if (teamsResponse.ok) {
        teamsData = await teamsResponse.json()
      } else {
        console.error("Teams API failed:", await teamsResponse.text())
      }

      // Build team names map
      const names: { [key: number]: string } = {}
      for (const team of (teamsData.teams || [])) {
        if (team.teamNumber && team.nameShort) {
          names[team.teamNumber] = team.nameShort
        }
      }
      setTeamNames(names)

      setLoadingStep(5) // Finalizing dashboard

      setTeamStats(statsData.stats)
      setRankings(rankingsData.rankings || [])
      setAlliances(alliancesData.alliances || [])
      setMatches(matchesData.matches || [])

      // Find next match
      const upcomingMatches = (matchesData.matches || []).filter((m: Match) => !m.played)
      setNextMatch(upcomingMatches.length > 0 ? upcomingMatches[0] : null)

      setLastUpdate(new Date())
      console.log("Dashboard data loaded successfully")
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      setError("Failed to load dashboard data. Please check your connection.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    const tick = async () => {
      await fetchData()
      if (autoRefreshInterval > 0) {
        timeoutId = setTimeout(tick, autoRefreshInterval)
      }
    }

    tick()

    return () => {
      clearTimeout(timeoutId)
    }
  }, [eventCode, teamNumber, autoRefreshInterval])

  const teamRanking = rankings.find((r) => r.team === teamNumber)
  const teamAlliance = alliances.find(
    (a) => a.captain === teamNumber || a.round1 === teamNumber || a.round2 === teamNumber || a.backup === teamNumber,
  )

  const onMatchClick = (match: Match) => {
    setSelectedMatch(match)
    setMatchDialogOpen(true)
  }

  const teamLabel = (num: number) => {
    const name = teamNames[num]
    return name ? `${num} ${name}` : `${num}`
  }


  if (loading) {
    return <LoadingProgress steps={loadingSteps} currentStep={loadingStep} />
  }
  const handleTabChange = (value: string) => {
    router.push(`/dashboard/${eventCode}/${teamNumber}?tab=${value}`)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="pt-3 container mx-auto self-center">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <Link href={`/event/${eventCode}`}>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-normal">
              {teamNumber} - {teamName ? teamName : ""}{" "}
              <span className="text-lg font-light opacity-70">{eventCode.toUpperCase()}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted-foreground">
              last update: <TimeAgoDisplay lastUpdate={lastUpdate} />
            </p>
            <Button variant="outline" size="sm" onClick={fetchData} className="h-8 w-8 p-0">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-2">
                  <Settings className="h-3.5 w-3.5" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setShowThemeDialog(true)}>
                  Theme Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setPendingInterval(autoRefreshInterval)
                    setShowIntervalModal(true)
                  }}
                >
                  Change Auto-Refresh Delay
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <ThemeSettingsDialog open={showThemeDialog} onOpenChange={setShowThemeDialog} />
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid w-full grid-cols-6 h-9">
            <TabsTrigger value="general" className="text-xs">General</TabsTrigger>
            <TabsTrigger value="watch" className="text-xs">Watch</TabsTrigger>
            <TabsTrigger value="team-stats" className="text-xs">Team Stats</TabsTrigger>
            <TabsTrigger value="event-stats" className="text-xs">Event Stats</TabsTrigger>
            <TabsTrigger value="rankings" className="text-xs">Rankings</TabsTrigger>
            <TabsTrigger value="playoffs" className="text-xs">Playoffs</TabsTrigger>
          </TabsList>

          <div className="mt-3">
            <TabsContent value="general">
              <GeneralTab
                eventCode={eventCode}
                teamNumber={teamNumber}
                ranking={teamRanking ? teamRanking : null}
                teamStats={teamStats ? teamStats : null}
                matches={matches}
                rankings={rankings}
                teamNames={teamNames}
                onMatchClick={onMatchClick}
              />
            </TabsContent>

            <TabsContent value="watch" forceMount className={currentTab !== 'watch' ? 'hidden' : ''}>
              <WatchTab
                eventCode={eventCode}
                teamNumber={teamNumber}
                rankings={rankings}
                matches={matches}
                teamNames={teamNames}
                onMatchClick={onMatchClick}
              />
            </TabsContent>

            <TabsContent value="team-stats">
              <TeamStatsTab eventCode={eventCode} teamNumber={teamNumber} matches={matches} teamStats={teamStats} ranking={teamRanking} teamNames={teamNames} onMatchClick={onMatchClick} />
            </TabsContent>

            <TabsContent value="event-stats">
              <EventStatsTab eventCode={eventCode} teamNames={teamNames} />
            </TabsContent>

            <TabsContent value="rankings">
              <RankingsScheduleTab
                eventCode={eventCode}
                teamNumber={teamNumber}
                rankings={rankings}
                matches={matches}
                teamNames={teamNames}
                onMatchClick={onMatchClick}
              />
            </TabsContent>

            <TabsContent value="playoffs">
              <PlayoffsTab
                eventCode={eventCode}
                teamNumber={teamNumber}
                alliances={alliances}
                matches={matches}
                teamNames={teamNames}
                onMatchClick={onMatchClick}
              />
            </TabsContent>
          </div>
        </Tabs>

        {error && (
          <Card className="mb-3" style={{ backgroundColor: 'var(--color-warning)', borderColor: 'var(--color-warning)' }}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" style={{ color: 'var(--color-background)' }} />
                <div className="flex-1">
                  <p className="text-xs" style={{ color: 'var(--color-background)' }}>{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Next Match Alert */}
        {nextMatch && (
          <Card className="mb-3" style={{ backgroundColor: 'var(--color-info)', borderColor: 'var(--color-info)' }}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" style={{ color: 'var(--color-background)' }} />
                <div className="flex-1">
                  <h3 className="font-semibold text-xs" style={{ color: 'var(--color-background)' }}>
                    Next Match: {nextMatch.description}
                  </h3>
                  <p className="text-[11px]" style={{ color: 'var(--color-background)', opacity: 0.9 }}>
                    {nextMatch.startTime ? new Date(nextMatch.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Time TBD"} • Red:{" "}
                    {teamLabel(nextMatch.red1)}, {teamLabel(nextMatch.red2)} vs Blue: {teamLabel(nextMatch.blue1)}, {teamLabel(nextMatch.blue2)}
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px] py-0 px-2">Match {nextMatch.matchNumber}</Badge>
              </div>
            </CardContent>
          </Card>
        )}



        <Dialog open={showIntervalModal} onOpenChange={setShowIntervalModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Change Auto-Refresh Interval</DialogTitle>
              <DialogDescription>
                Set how frequently the dashboard data will automatically refresh. Minimum 5
                seconds.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="refresh-interval" className="text-right">
                  Interval (s)
                </Label>
                <Input
                  id="refresh-interval"
                  type="number"
                  min={5}
                  max={600}
                  value={pendingInterval ? pendingInterval / 1000 : ""}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === "" || Number.isNaN(Number(val))) {
                      setPendingInterval(0)
                    } else {
                      setPendingInterval(Number(val) * 1000)
                    }
                  }}
                  className="col-span-3"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowIntervalModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  const newInterval = pendingInterval >= 5000 ? pendingInterval : 5000
                  setAutoRefreshInterval(newInterval)
                  setShowIntervalModal(false)
                }}
              >
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <MatchDetailDialog
          match={selectedMatch}
          open={matchDialogOpen}
          onOpenChange={setMatchDialogOpen}
          eventCode={eventCode}
          teamNames={teamNames}
        />
      </div >
    </div >
  )
}
