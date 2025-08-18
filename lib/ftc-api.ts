
// FTC Events API integration
interface FTCEvent {
  code: string
  name: string
  address: string
  city: string
  stateprov: string
  country: string
  venue: string
  dateStart: string
  dateEnd: string
  divisionCode?: string
}

interface FTCTeam {
  teamNumber: number
  nameFull: string
  nameShort: string
  schoolName: string
  city: string
  stateProv: string
  country: string
}

class FTCEventsAPI {
  private baseUrl = "https://ftc-api.firstinspires.org/v2.0"
  private authHeader: string | null = null

  setCredentials(username: string, authKey: string) {
    const credentials = `${username}:${authKey}`
    this.authHeader = `Basic ${btoa(credentials)}`
  }

  private async makeRequest(endpoint: string): Promise<any> {
    if (!this.authHeader) {
      throw new Error("FTC API credentials not configured")
    }

    try {
      const url = `${this.baseUrl}${endpoint}`
      console.log(`Making FTC API request to: ${url}`)

      const response = await fetch(url, {
        headers: {
          Authorization: this.authHeader,
          Accept: "application/json",
          "User-Agent": "FTC-Scouting-App/1.0",
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      console.log(`FTC API response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`FTC API error response: ${errorText}`)

        if (response.status === 401) {
          throw new Error("Invalid FTC API credentials")
        }
        throw new Error(`FTC API error: ${response.status} ${response.statusText}`)
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        console.error(`FTC API returned non-JSON response: ${text.substring(0, 200)}...`)
        throw new Error("FTC API returned invalid response format")
      }

      return response.json()
    } catch (error) {
      console.error("FTC API request failed:", error)
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw new Error("Network error: Unable to connect to FTC API")
      }
      throw error
    }
  }

  async getEvents(season = Number.parseInt(process.env.FTC_SEASON || "2024")): Promise<FTCEvent[]> {
    if (!this.authHeader) {
      console.log("No FTC API credentials configured")
      return []
    }

    try {
      const data = await this.makeRequest(`/${season}/events`)
      return data.events || []
    } catch (error) {
      console.error("Failed to fetch FTC events:", error)
      return []
    }
  }

  async getTeams(season = Number.parseInt(process.env.FTC_SEASON || "2024"), eventCode: string): Promise<FTCTeam[]> {
    if (!this.authHeader) {
      console.log("No FTC API credentials configured")
      return []
    }

    if (!eventCode) {
      console.log("No event code provided for teams lookup")
      return []
    }

    try {
      const data = await this.makeRequest(`/${season}/teams?eventCode=${eventCode}`)
      return data.teams || []
    } catch (error) {
      console.error("Failed to fetch FTC teams:", error)
      return []
    }
  }

  isConfigured(): boolean {
    return this.authHeader !== null
  }
}

export const ftcAPI = new FTCEventsAPI()

// Set credentials if available in environment
if (process.env.FTC_API_USERNAME && process.env.FTC_API_KEY) {
  ftcAPI.setCredentials(process.env.FTC_API_USERNAME, process.env.FTC_API_KEY)
}
