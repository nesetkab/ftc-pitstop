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
import { ModularDashboard } from "@/components/dashboard"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import * as React from "react"
import ScoutingManager from "@/components/scouting-manager"
import IconSwitch from "@/components/ui/icon_switch"
import { useSearchParams } from 'next/navigation'

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
  ccwm: number
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
  const params = useParams()
  const eventCode = params.eventCode as string
  const teamNumber = Number.parseInt(params.teamNumber as string)
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null)
  const [selectedView, setSelectedView] = useState<string>('dashboard');
  const [rankings, setRankings] = useState<Ranking[]>([])
  const [alliances, setAlliances] = useState<Alliance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [nextMatch, setNextMatch] = useState<Match | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null);
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('sessionId')


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

  const fetchData = async () => {
    try {
      setError(null)
      console.log("Fetching dashboard data for team", teamNumber, "at event", eventCode)

      const [statsResponse, matchesResponse, rankingsResponse, alliancesResponse] = await Promise.all([
        fetch(`/api/teams/${teamNumber}/stats/${eventCode}`),
        fetch(`/api/events/${eventCode}/matches?team=${teamNumber}`),
        fetch(`/api/events/${eventCode}/rankings`),
        fetch(`/api/events/${eventCode}/alliances`),
      ])

      console.log("API Response statuses:", {
        stats: statsResponse.status,
        matches: matchesResponse.status,
        rankings: rankingsResponse.status,
        alliances: alliancesResponse.status,
      })

      // Handle each response individually to avoid failing everything if one fails
      let statsData = { stats: null }
      let matchesData = { matches: [] }
      let rankingsData = { rankings: [] }
      let alliancesData = { alliances: [] }

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

      setTeamStats(statsData.stats)
      setRankings(rankingsData.rankings || [])
      setAlliances(alliancesData.alliances || [])

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
    fetchData();
    const interval = setInterval(fetchData, autoRefreshInterval);
    return () => clearInterval(interval);
  }, [eventCode, teamNumber, autoRefreshInterval]);

  const teamRanking = rankings.find((r) => r.team === teamNumber)
  const teamAlliance = alliances.find(
    (a) => a.captain === teamNumber || a.round1 === teamNumber || a.round2 === teamNumber || a.backup === teamNumber,
  )


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading team dashboard...</p>
        </div>
      </div>
    )
  }
  const menuOptions = [
    {
      id: 'dash',
      icon: <Monitor size={18} />,
      label: 'Dashboard',
      component: <ModularDashboard className="max-w-screen" eventCode={eventCode} teamNumber={teamNumber} ranking={teamRanking} rankings={rankings} alliance={teamAlliance} teamStats={teamStats} />
    },
    {
      id: 'scout',
      icon: <ClipboardPen size={18} />,
      label: 'Scouting',
      component: <ScoutingManager
        sessionId={sessionId ? sessionId : ""}
        eventCode={eventCode ? eventCode : ""}
        onSessionCreate={(sessionCode) => {
          console.log('Session created:', sessionCode)
        }}
      />
    },
    {
      id: 'idk',
      icon: <Bell size={18} />,
      label: 'what ot put here',
      component: <div>idk</div>
    }
  ];
  const selectedComponent = menuOptions.find(option => option.id === selectedView)?.component;

  return (
    <div className=" h-screen bg-white dark:bg-black">
      <div className="pt-4 container mx-auto self-center ">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Link href={`/event/${eventCode}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 " />
              </Button>
            </Link>
            <h1 className="text-3xl font-black">{teamNumber} - {teamName ? teamName : ""} <span className="text-xl font-extralight">{eventCode.toUpperCase()}</span></h1>
          </div>
          <div>
            <IconSwitch
              options={menuOptions}
              defaultSelected="dash"
              onSelectionChange={setSelectedView}
            />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">last update: <TimeAgoDisplay lastUpdate={lastUpdate} /> </p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <div className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3" >
                  <Settings className="h-4 w-4" />
                </div>

              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {/* no clue what theme or status bar is supposed to do, home should be in a navbar*/}
                <DropdownMenuItem>Theme</DropdownMenuItem>
                <DropdownMenuItem>Change Team</DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setPendingInterval(autoRefreshInterval);
                  setShowIntervalModal(true);
                }}>
                  Change Auto-Refresh Delay
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          </div>
        </div>
        {selectedComponent && (
          <div className="transition-all duration-300 ease-in-out">
            {selectedComponent}
          </div>
        )}

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

        {/* Next Match Alert */}
        {nextMatch && (
          <Card className="mb-6 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-orange-600" />
                <div className="flex-1">
                  <h3 className="font-semibold text-orange-900 dark:text-orange-100">
                    Next Match: {nextMatch.description}
                  </h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    {nextMatch.startTime ? new Date(nextMatch.startTime).toLocaleTimeString() : "Time TBD"} • Red:{" "}
                    {nextMatch.red1}, {nextMatch.red2} vs Blue: {nextMatch.blue1}, {nextMatch.blue2}
                  </p>
                </div>
                <Badge variant="secondary">Match {nextMatch.matchNumber}</Badge>
              </div>
            </CardContent>
          </Card>
        )}



        {showIntervalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white dark:bg-black border-black dark:border-white border rounded-lg shadow-lg p-6 w-full max-w-xs">
              <h2 className="text-lg font-bold mb-2">Change Auto-Refresh Interval</h2>
              <label className="block mb-4">
                <span className="text-sm text-muted-foreground">Interval (seconds):</span>
                <input
                  type="number"
                  min={5}
                  max={600}
                  // When there is no input, it removes the 0 by default
                  value={pendingInterval ? pendingInterval / 1000 : ""}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === "" || isNaN(Number(val))) {
                      setPendingInterval(0);
                    } else {
                      setPendingInterval(Number(val) * 1000);
                    }
                  }}
                  className="mt-1 block w-full rounded border border-gray-300 dark:border-gray-700 px-2 py-1 bg-background"
                />
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowIntervalModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => {
                  setAutoRefreshInterval(pendingInterval);
                  setShowIntervalModal(false);
                }}>
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}

      </div >
    </div >
  )
}
