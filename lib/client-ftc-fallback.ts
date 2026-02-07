/**
 * Client-Side FTC API Fallback
 * Allows direct FTC API calls when the server is unavailable
 *
 * WARNING: This exposes API credentials to the client.
 * Only use this as a fallback mechanism when your server is down.
 */

const FTC_API_BASE = "https://ftc-api.firstinspires.org/v2.0"

interface FallbackConfig {
  season: string
  username: string
  apiKey: string
}

let fallbackConfig: FallbackConfig | null = null

/**
 * Initialize the fallback with credentials
 * This should be called from the client with credentials from localStorage or environment
 */
export function initFallback(config: FallbackConfig) {
  fallbackConfig = config
  console.warn('[FTC Fallback] Initialized - Will use direct API calls if server fails')
}

/**
 * Check if fallback is available
 */
export function isFallbackAvailable(): boolean {
  return fallbackConfig !== null
}

/**
 * Fetch with automatic fallback
 * Tries server first, falls back to direct FTC API if server fails
 */
export async function fetchWithFallback<T>(
  serverEndpoint: string,
  ftcApiPath: string,
  options?: RequestInit
): Promise<T> {
  // Try server first
  try {
    console.log(`[FTC Fallback] Attempting server: ${serverEndpoint}`)
    const serverResponse = await fetch(serverEndpoint, {
      ...options,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (serverResponse.ok) {
      const data = await serverResponse.json()
      console.log(`[FTC Fallback] ✓ Server succeeded`)
      return data
    }

    console.warn(`[FTC Fallback] Server failed: ${serverResponse.status}`)
    throw new Error(`Server returned ${serverResponse.status}`)
  } catch (serverError) {
    console.error('[FTC Fallback] Server error:', serverError)

    // Fallback to direct FTC API
    if (!fallbackConfig) {
      throw new Error('Server unavailable and fallback not configured')
    }

    console.warn('[FTC Fallback] ⚠️  Using direct FTC API (fallback mode)')

    const auth = btoa(`${fallbackConfig.username}:${fallbackConfig.apiKey}`)
    const ftcUrl = `${FTC_API_BASE}/${fallbackConfig.season}/${ftcApiPath}`

    const ftcResponse = await fetch(ftcUrl, {
      ...options,
      headers: {
        ...options?.headers,
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    })

    if (!ftcResponse.ok) {
      const errorText = await ftcResponse.text()
      throw new Error(`FTC API Error (${ftcResponse.status}): ${errorText}`)
    }

    const data = await ftcResponse.json()
    console.log('[FTC Fallback] ✓ Direct FTC API succeeded')
    return data
  }
}

/**
 * Helper functions for common endpoints
 */

export async function getRankingsFallback(eventCode: string) {
  return fetchWithFallback(
    `/api/events/${eventCode}/rankings`,
    `rankings/${eventCode}`
  )
}

export async function getMatchesFallback(eventCode: string, teamNumber?: number) {
  const serverPath = teamNumber
    ? `/api/events/${eventCode}/matches?team=${teamNumber}`
    : `/api/events/${eventCode}/matches`

  const ftcPath = `matches/${eventCode}`

  return fetchWithFallback(serverPath, ftcPath)
}

export async function getTeamsFallback(eventCode: string) {
  return fetchWithFallback(
    `/api/events/${eventCode}/teams`,
    `teams?eventCode=${eventCode}`
  )
}

export async function getAlliancesFallback(eventCode: string) {
  return fetchWithFallback(
    `/api/events/${eventCode}/alliances`,
    `alliances/${eventCode}`
  )
}

export async function getEventsFallback() {
  return fetchWithFallback(
    `/api/events/search?q=`,
    `events`
  )
}

/**
 * Load credentials from environment or localStorage
 * This allows the fallback to work in client-only scenarios
 */
export function loadFallbackCredentials() {
  if (typeof window === 'undefined') {
    return // Server-side, skip
  }

  // Try to load from localStorage first
  const storedConfig = localStorage.getItem('ftc_fallback_config')
  if (storedConfig) {
    try {
      const config = JSON.parse(storedConfig)
      initFallback(config)
      return
    } catch (e) {
      console.error('Failed to parse stored fallback config')
    }
  }

  // Fallback to environment variables (if exposed)
  if (process.env.NEXT_PUBLIC_FTC_SEASON) {
    initFallback({
      season: process.env.NEXT_PUBLIC_FTC_SEASON,
      username: process.env.NEXT_PUBLIC_FTC_USERNAME || '',
      apiKey: process.env.NEXT_PUBLIC_FTC_API_KEY || '',
    })
  }
}

/**
 * Save credentials to localStorage for future fallback use
 */
export function saveFallbackCredentials(config: FallbackConfig) {
  if (typeof window === 'undefined') {
    return
  }

  localStorage.setItem('ftc_fallback_config', JSON.stringify(config))
  initFallback(config)
  console.log('[FTC Fallback] Credentials saved for offline use')
}
