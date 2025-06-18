"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"
import Link from "next/link"

export default function TestPage() {
  const [connectionResult, setConnectionResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [testEventCode, setTestEventCode] = useState("USUTCMP")

  const testConnection = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/test-connection")
      const data = await response.json()
      setConnectionResult(data)
    } catch (error) {
      setConnectionResult({ success: false, error: "Failed to test connection" })
    } finally {
      setLoading(false)
    }
  }

  const testEventAPI = async (eventCode: string) => {
    console.log("Testing event:", eventCode)
    try {
      const [eventResponse, teamsResponse, matchesResponse, rankingsResponse] = await Promise.all([
        fetch(`/api/events/${eventCode}`),
        fetch(`/api/events/${eventCode}/teams`),
        fetch(`/api/events/${eventCode}/matches`),
        fetch(`/api/events/${eventCode}/rankings`),
      ])

      console.log("Event API Results:", {
        event: eventResponse.status,
        teams: teamsResponse.status,
        matches: matchesResponse.status,
        rankings: rankingsResponse.status,
      })

      const results = {
        event: { status: eventResponse.status, ok: eventResponse.ok },
        teams: { status: teamsResponse.status, ok: teamsResponse.ok },
        matches: { status: matchesResponse.status, ok: matchesResponse.ok },
        rankings: { status: rankingsResponse.status, ok: rankingsResponse.ok },
      }

      if (eventResponse.ok) {
        const eventData = await eventResponse.json()
        results.event = { ...results.event, data: eventData.event }
      }

      if (teamsResponse.ok) {
        const teamsData = await teamsResponse.json()
        results.teams = { ...results.teams, count: teamsData.teams?.length || 0 }
      }

      alert(`Event Test Results for ${eventCode}:\n${JSON.stringify(results, null, 2)}`)
    } catch (error) {
      alert(`Error testing event ${eventCode}: ${error}`)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">FTC API Test Page</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>API Connection Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={testConnection} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Test API Connection
            </Button>

            {connectionResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  {connectionResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={connectionResult.success ? "text-green-600" : "text-red-600"}>
                    {connectionResult.success ? "Connection Successful" : "Connection Failed"}
                  </span>
                </div>

                {connectionResult.success && (
                  <div className="space-y-2">
                    <p>Total Events: {connectionResult.totalEvents}</p>
                    <div>
                      <h4 className="font-semibold mb-2">Sample Event Codes:</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {connectionResult.sampleEvents?.map((event: any) => (
                          <div key={event.code} className="p-2 border rounded">
                            <Badge variant="outline" className="mb-1">
                              {event.code}
                            </Badge>
                            <p className="text-sm">{event.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {event.city}, {event.state}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {!connectionResult.success && (
                  <div className="text-red-600 text-sm">
                    <p>Status: {connectionResult.status}</p>
                    <p>Error: {connectionResult.error}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Specific Event</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter event code (e.g., USWACMP)"
                value={testEventCode}
                onChange={(e) => setTestEventCode(e.target.value)}
              />
              <Button onClick={() => testEventAPI(testEventCode)} disabled={!testEventCode.trim()}>
                Test Event
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => testEventAPI("USWACMP")}>
                Test USWACMP
              </Button>
              <Button variant="outline" onClick={() => testEventAPI("FTCCMP1")}>
                Test FTCCMP1
              </Button>
              <Button variant="outline" onClick={() => testEventAPI("USUTCMP")}>
                Test USUTCMP
              </Button>
              <Button variant="outline" onClick={() => testEventAPI("USCASDCMP")}>
                Test USCASDCMP
              </Button>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>Find event codes at <Link href="https://ftc-events.firstinspires.org/" target="_blank" className="text-purple-600 underline">ftc-events</Link></p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Dashboard Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => (window.location.href = "/dashboard/USUTCMP/3747")}>
                USUTCMP Team 3747
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = "/dashboard/USMIWAT/1234")}>
                USMIWAT Team 1234
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = "/dashboard/USUTCMP/5678")}>
                USUTCMP Team 5678
              </Button>
              <Button variant="outline" onClick={() => (window.location.href = "/dashboard/USCASD/9999")}>
                USCASD Team 9999
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
