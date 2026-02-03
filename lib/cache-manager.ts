/**
 * Cache Manager for FTC API Data
 * Provides server-side caching with Redis (Upstash KV)
 * Falls back to in-memory cache if Redis is unavailable
 */

// Conditionally import Vercel KV if available
let kv: any = null
try {
  // @ts-ignore - Optional dependency
  const kvModule = require('@vercel/kv')
  kv = kvModule.kv
} catch (e) {
  console.log('[Cache] @vercel/kv not available, using in-memory cache only')
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in seconds
}

// In-memory fallback cache
const memoryCache = new Map<string, CacheEntry<any>>()

// Default TTLs (in seconds)
export const CACHE_TTL = {
  EVENTS: 300, // 5 minutes - events don't change often
  RANKINGS: 60, // 1 minute - rankings update frequently during events
  MATCHES: 30, // 30 seconds - match data changes quickly
  TEAMS: 600, // 10 minutes - team info rarely changes
  OPR: 120, // 2 minutes - OPR recalculates as matches complete
  ALLIANCES: 180, // 3 minutes - alliances form during playoffs
}

export class CacheManager {
  private useRedis: boolean

  constructor() {
    // Check if Redis is available (both package and env vars)
    this.useRedis = !!(kv && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
    if (!this.useRedis) {
      console.log('[Cache] Redis unavailable, using in-memory cache only')
    }
  }

  /**
   * Generate a cache key
   */
  private getCacheKey(namespace: string, identifier: string): string {
    return `ftc:${namespace}:${identifier}`
  }

  /**
   * Get data from cache
   */
  async get<T>(namespace: string, identifier: string): Promise<T | null> {
    const key = this.getCacheKey(namespace, identifier)

    try {
      if (this.useRedis) {
        // Try Redis first
        const cached = await kv.get(key) as CacheEntry<T> | null

        if (cached && this.isValid(cached)) {
          console.log(`[Cache HIT] Redis: ${key}`)
          return cached.data
        }
      }

      // Fallback to memory cache
      const memCached = memoryCache.get(key)
      if (memCached && this.isValid(memCached)) {
        console.log(`[Cache HIT] Memory: ${key}`)
        return memCached.data as T
      }

      console.log(`[Cache MISS] ${key}`)
      return null
    } catch (error) {
      console.error(`[Cache Error] ${key}:`, error)
      return null
    }
  }

  /**
   * Set data in cache
   */
  async set<T>(namespace: string, identifier: string, data: T, ttl: number): Promise<void> {
    const key = this.getCacheKey(namespace, identifier)
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    }

    try {
      // Store in Redis
      if (this.useRedis) {
        await kv.set(key, entry, { ex: ttl })
        console.log(`[Cache SET] Redis: ${key} (TTL: ${ttl}s)`)
      }

      // Always store in memory as backup
      memoryCache.set(key, entry)
      console.log(`[Cache SET] Memory: ${key} (TTL: ${ttl}s)`)
    } catch (error) {
      console.error(`[Cache Error] Failed to set ${key}:`, error)
    }
  }

  /**
   * Invalidate specific cache entry
   */
  async invalidate(namespace: string, identifier: string): Promise<void> {
    const key = this.getCacheKey(namespace, identifier)

    try {
      if (this.useRedis) {
        await kv.del(key)
      }
      memoryCache.delete(key)
      console.log(`[Cache INVALIDATE] ${key}`)
    } catch (error) {
      console.error(`[Cache Error] Failed to invalidate ${key}:`, error)
    }
  }

  /**
   * Invalidate all cache entries in a namespace
   */
  async invalidateNamespace(namespace: string): Promise<void> {
    try {
      // Clear memory cache for this namespace
      const prefix = `ftc:${namespace}:`
      for (const key of memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          memoryCache.delete(key)
        }
      }

      // Redis pattern deletion (if supported)
      if (this.useRedis) {
        // Note: Upstash KV might not support pattern deletion
        // This would need to track keys separately
        console.log(`[Cache INVALIDATE] Namespace: ${namespace}`)
      }
    } catch (error) {
      console.error(`[Cache Error] Failed to invalidate namespace ${namespace}:`, error)
    }
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid<T>(entry: CacheEntry<T>): boolean {
    const age = (Date.now() - entry.timestamp) / 1000 // age in seconds
    return age < entry.ttl
  }

  /**
   * Clean up expired entries from memory cache
   */
  cleanupMemoryCache(): void {
    const now = Date.now()
    for (const [key, entry] of memoryCache.entries()) {
      const age = (now - entry.timestamp) / 1000
      if (age >= entry.ttl) {
        memoryCache.delete(key)
      }
    }
  }
}

// Singleton instance
export const cacheManager = new CacheManager()

// Cleanup memory cache every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cacheManager.cleanupMemoryCache()
  }, 5 * 60 * 1000)
}
