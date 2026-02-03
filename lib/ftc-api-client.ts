/**
 * FTC API Client with Server-Side Caching
 * All API calls go through the cache layer first
 */

import { cacheManager, CACHE_TTL } from './cache-manager'

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

export interface FetchOptions {
  bypassCache?: boolean
  cacheTTL?: number
}

// FTC API Response Types
export interface FTCTeam {
  teamNumber: number
  nameShort: string
  nameFull?: string
  schoolName?: string
  city?: string
  stateProv?: string
  country?: string
  website?: string
  rookieYear?: number
  robotName?: string
  districtCode?: string | null
  homeCMP?: string | null
}

export interface FTCEvent {
  code: string
  divisionCode?: string | null
  name: string
  remote: boolean
  hybrid: boolean
  fieldCount: number
  published: boolean
  type: string
  typeName: string
  regionCode?: string
  leagueCode?: string | null
  districtCode?: string | null
  venue: string
  address?: string
  city: string
  stateprov: string
  country: string
  website?: string | null
  liveStreamUrl?: string | null
  webcasts?: string[]
  timezone: string
  dateStart: string
  dateEnd: string
}

export interface FTCRanking {
  rank: number
  teamNumber: number
  sortOrder1: number
  sortOrder2: number
  sortOrder3: number
  sortOrder4: number
  sortOrder5: number
  sortOrder6: number
  wins: number
  losses: number
  ties: number
  qualAverage: number
  dq: number
  matchesPlayed: number
  matchesCounted?: number
  rankingPoints?: number
  tieBreakerPoints?: number
  // Aliases that may appear in API responses
  rp?: number
  tbp?: number
}

export interface FTCMatchTeam {
  teamNumber: number
  station: string
  dq: boolean
  onField: boolean
}

export interface FTCMatch {
  matchNumber: number
  description: string
  field?: string
  tournamentLevel: string
  series: number
  matchInSeries?: number
  actualStartTime?: string
  postResultTime?: string
  scheduledStartTime?: string
  teams: FTCMatchTeam[]
  scoreRedFinal: number | null
  scoreRedFoul: number | null
  scoreRedAuto?: number | null
  scoreBlueFinal: number | null
  scoreBlueFoul: number | null
  scoreBlueAuto?: number | null
  randomization?: number
  modifiedOn?: string
}

export interface FTCAlliance {
  number: number
  name?: string
  captain: number
  round1: number
  round2: number
  round3?: number | null
  backup?: number | null
  backupReplaced?: number | null
}

export interface FTCScoreDetail {
  matchNumber: number
  matchLevel: string
  alliances: Array<{
    alliance: string
    autoPoints?: number
    dcPoints?: number
    endgamePoints?: number
    penaltyPointsCommitted?: number
    totalPoints?: number
    teleopBasePoints?: number
    [key: string]: unknown
  }>
}

// API Response wrappers
export interface EventsResponse {
  events: FTCEvent[]
}

export interface TeamsResponse {
  teams: FTCTeam[]
}

export interface RankingsResponse {
  rankings: FTCRanking[]
}

export interface MatchesResponse {
  matches: FTCMatch[]
}

export interface AlliancesResponse {
  alliances: FTCAlliance[]
}

export interface ScoreDetailsResponse {
  matchScores?: FTCScoreDetail[]
  MatchScores?: FTCScoreDetail[]
}

export class FTCApiClient {
  private season: string
  private authHeader: string

  constructor() {
    this.season = process.env.FTC_SEASON || '2025'
    const auth = Buffer.from(
      `${process.env.FTC_USERNAME}:${process.env.FTC_API_KEY}`
    ).toString('base64')
    this.authHeader = `Basic ${auth}`
  }

  /**
   * Generic fetch with caching
   */
  private async fetchWithCache<T>(
    endpoint: string,
    cacheNamespace: string,
    cacheIdentifier: string,
    ttl: number,
    options?: FetchOptions
  ): Promise<{ data: T; fromCache: boolean }> {
    // Check cache first (unless bypassed)
    if (!options?.bypassCache) {
      const cached = await cacheManager.get<T>(cacheNamespace, cacheIdentifier)
      if (cached !== null) {
        return { data: cached, fromCache: true }
      }
    }

    // Fetch from FTC API
    const url = `${FTC_API_BASE}/${this.season}/${endpoint}`
    console.log(`[FTC API] Fetching: ${url}`)

    const response = await fetch(url, {
      headers: {
        Authorization: this.authHeader,
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`FTC API Error (${response.status}): ${errorText}`)
    }

    const data = await response.json()

    // Cache the result
    const cacheTTL = options?.cacheTTL ?? ttl
    await cacheManager.set(cacheNamespace, cacheIdentifier, data, cacheTTL)

    return { data, fromCache: false }
  }

  /**
   * Get all events for the season
   */
  async getEvents(options?: FetchOptions): Promise<{ data: EventsResponse; fromCache: boolean }> {
    return this.fetchWithCache<EventsResponse>(
      'events',
      'events',
      'all',
      CACHE_TTL.EVENTS,
      options
    )
  }

  /**
   * Get specific event
   */
  async getEvent(eventCode: string, options?: FetchOptions): Promise<{ data: EventsResponse; fromCache: boolean }> {
    return this.fetchWithCache<EventsResponse>(
      `events?eventCode=${eventCode}`,
      'events',
      eventCode,
      CACHE_TTL.EVENTS,
      options
    )
  }

  /**
   * Get teams for an event
   */
  async getTeams(eventCode: string, options?: FetchOptions): Promise<{ data: TeamsResponse; fromCache: boolean }> {
    return this.fetchWithCache<TeamsResponse>(
      `teams?eventCode=${eventCode}`,
      'teams',
      eventCode,
      CACHE_TTL.TEAMS,
      options
    )
  }

  /**
   * Get rankings for an event
   */
  async getRankings(eventCode: string, options?: FetchOptions): Promise<{ data: RankingsResponse; fromCache: boolean }> {
    return this.fetchWithCache<RankingsResponse>(
      `rankings/${eventCode}`,
      'rankings',
      eventCode,
      CACHE_TTL.RANKINGS,
      options
    )
  }

  /**
   * Get matches for an event
   */
  async getMatches(eventCode: string, options?: FetchOptions): Promise<{ data: MatchesResponse; fromCache: boolean }> {
    return this.fetchWithCache<MatchesResponse>(
      `matches/${eventCode}`,
      'matches',
      eventCode,
      CACHE_TTL.MATCHES,
      options
    )
  }

  /**
   * Get alliances for an event
   */
  async getAlliances(eventCode: string, options?: FetchOptions): Promise<{ data: AlliancesResponse; fromCache: boolean }> {
    return this.fetchWithCache<AlliancesResponse>(
      `alliances/${eventCode}`,
      'alliances',
      eventCode,
      CACHE_TTL.ALLIANCES,
      options
    )
  }

  /**
   * Get score details for an event
   */
  async getScoreDetails(eventCode: string, tournamentLevel: string = 'qual', options?: FetchOptions): Promise<{ data: ScoreDetailsResponse; fromCache: boolean }> {
    return this.fetchWithCache<ScoreDetailsResponse>(
      `scores/${eventCode}/${tournamentLevel}`,
      'scores',
      `${eventCode}-${tournamentLevel}`,
      CACHE_TTL.MATCHES, // Same TTL as matches since they're related
      options
    )
  }

  /**
   * Invalidate cache for an event (useful for live events)
   */
  async invalidateEvent(eventCode: string) {
    await Promise.all([
      cacheManager.invalidate('events', eventCode),
      cacheManager.invalidate('teams', eventCode),
      cacheManager.invalidate('rankings', eventCode),
      cacheManager.invalidate('matches', eventCode),
      cacheManager.invalidate('alliances', eventCode),
      cacheManager.invalidate('scores', `${eventCode}-qual`),
      cacheManager.invalidate('scores', `${eventCode}-playoff`),
    ])
    console.log(`[Cache] Invalidated all data for event: ${eventCode}`)
  }
}

// Singleton instance
export const ftcApiClient = new FTCApiClient()
