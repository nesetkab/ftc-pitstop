/**
 * Cache Manager for FTC API Data
 * Provides server-side caching with MongoDB
 * Falls back to in-memory cache if MongoDB is not available
 */

// Conditionally import MongoDB if available
let MongoClient: any = null
let mongoDb: any = null
let mongoCollection: any = null
let mongoConnecting: Promise<void> | null = null

try {
  // @ts-ignore - Optional dependency
  const mongoModule = require('mongodb')
  MongoClient = mongoModule.MongoClient
} catch (e) {
  // mongodb not available
}

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in seconds
}

interface MongoCacheDoc {
  key: string
  data: any
  timestamp: number
  ttl: number
  expiresAt: Date
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

async function connectMongo(): Promise<void> {
  if (mongoCollection) return
  if (!MongoClient || !process.env.MONGODB_URI) return

  if (mongoConnecting) {
    await mongoConnecting
    return
  }

  mongoConnecting = (async () => {
    try {
      const client = new MongoClient(process.env.MONGODB_URI)
      await client.connect()
      const dbName = process.env.MONGODB_DB || 'ftc-pitstop'
      const collectionName = process.env.MONGODB_CACHE_COLLECTION || 'cache'
      mongoDb = client.db(dbName)
      mongoCollection = mongoDb.collection(collectionName)

      // Ensure indexes exist
      await mongoCollection.createIndex({ key: 1 }, { unique: true })
      await mongoCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })

      console.log('[Cache] MongoDB connected successfully')
    } catch (error) {
      console.error('[Cache] MongoDB connection failed:', error)
      mongoCollection = null
    } finally {
      mongoConnecting = null
    }
  })()

  await mongoConnecting
}

export class CacheManager {
  private useMongo: boolean

  constructor() {
    this.useMongo = !!(MongoClient && process.env.MONGODB_URI)

    if (this.useMongo) {
      console.log('[Cache] MongoDB configured, connecting...')
      connectMongo()
    } else {
      console.log('[Cache] No MongoDB configured, using in-memory cache only')
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
      // Check in-memory first (fastest)
      const memCached = memoryCache.get(key)
      if (memCached && this.isValid(memCached)) {
        return memCached.data as T
      }

      // Try MongoDB if available
      if (this.useMongo) {
        await connectMongo()
        if (mongoCollection) {
          const doc = await mongoCollection.findOne({ key }) as MongoCacheDoc | null
          if (doc && this.isValid({ data: doc.data, timestamp: doc.timestamp, ttl: doc.ttl })) {
            // Populate memory cache for faster subsequent reads
            memoryCache.set(key, { data: doc.data, timestamp: doc.timestamp, ttl: doc.ttl })
            return doc.data as T
          }
        }
      }

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
      // Always store in memory
      memoryCache.set(key, entry)

      // Store in MongoDB if available
      if (this.useMongo) {
        await connectMongo()
        if (mongoCollection) {
          const doc: MongoCacheDoc = {
            key,
            data,
            timestamp: Date.now(),
            ttl,
            expiresAt: new Date(Date.now() + ttl * 1000),
          }
          await mongoCollection.updateOne(
            { key },
            { $set: doc },
            { upsert: true }
          )
        }
      }
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
      if (this.useMongo && mongoCollection) {
        await mongoCollection.deleteOne({ key })
      }
      memoryCache.delete(key)
    } catch (error) {
      console.error(`[Cache Error] Failed to invalidate ${key}:`, error)
    }
  }

  /**
   * Invalidate all cache entries in a namespace
   */
  async invalidateNamespace(namespace: string): Promise<void> {
    try {
      const prefix = `ftc:${namespace}:`

      // Clear from MongoDB
      if (this.useMongo && mongoCollection) {
        await mongoCollection.deleteMany({ key: { $regex: `^${prefix}` } })
      }

      // Clear memory cache for this namespace
      for (const key of memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          memoryCache.delete(key)
        }
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
