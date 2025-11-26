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
  async getEvents(options?: FetchOptions) {
    return this.fetchWithCache(
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
  async getEvent(eventCode: string, options?: FetchOptions) {
    return this.fetchWithCache(
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
  async getTeams(eventCode: string, options?: FetchOptions) {
    return this.fetchWithCache(
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
  async getRankings(eventCode: string, options?: FetchOptions) {
    return this.fetchWithCache(
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
  async getMatches(eventCode: string, options?: FetchOptions) {
    return this.fetchWithCache(
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
  async getAlliances(eventCode: string, options?: FetchOptions) {
    return this.fetchWithCache(
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
  async getScoreDetails(eventCode: string, tournamentLevel: string = 'qual', options?: FetchOptions) {
    return this.fetchWithCache(
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
