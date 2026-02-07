/**
 * Browser-side cache using sessionStorage
 * Prevents re-fetching the same data when switching tabs
 * Data auto-expires based on TTL
 */

interface CacheEntry {
  data: any
  timestamp: number
  ttl: number // seconds
}

// TTLs for browser cache (seconds)
export const BROWSER_CACHE_TTL = {
  COMPARISON: 120,   // 2 min - team comparison data
  OPR: 120,          // 2 min - OPR data
  MATCHES: 30,       // 30s - match data
  RANKINGS: 60,      // 1 min - rankings
}

function getCacheKey(url: string): string {
  return `ftc-cache:${url}`
}

export function getBrowserCache<T>(url: string): T | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = sessionStorage.getItem(getCacheKey(url))
    if (!raw) return null

    const entry: CacheEntry = JSON.parse(raw)
    const age = (Date.now() - entry.timestamp) / 1000

    if (age >= entry.ttl) {
      sessionStorage.removeItem(getCacheKey(url))
      return null
    }

    return entry.data as T
  } catch {
    return null
  }
}

export function setBrowserCache(url: string, data: any, ttl: number): void {
  if (typeof window === 'undefined') return

  try {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
    }
    sessionStorage.setItem(getCacheKey(url), JSON.stringify(entry))
  } catch {
    // sessionStorage might be full - silently fail
  }
}

/**
 * Fetch with browser-side caching.
 * Returns cached data if available and fresh, otherwise fetches from network.
 */
export async function cachedFetch<T>(url: string, ttl: number): Promise<{ data: T; fromCache: boolean }> {
  const cached = getBrowserCache<T>(url)
  if (cached) {
    return { data: cached, fromCache: true }
  }

  const response = await fetch(url)
  const data = await response.json()

  if (response.ok) {
    setBrowserCache(url, data, ttl)
  }

  return { data, fromCache: false }
}
