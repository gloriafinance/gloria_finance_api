import Redis from "ioredis"
import { CacheService } from "@/Shared/infrastructure/CacheService"
import { Logger } from "@/Shared/adapter"

export class UserPermissionsCache {
  private static instance: UserPermissionsCache
  private readonly logger = Logger(UserPermissionsCache.name)
  private readonly fallbackCache = CacheService.getInstance()
  private redis?: Redis
  private redisReady = false

  private constructor() {
    const redisUrl = process.env.REDIS_URL

    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      })

      this.redis.on("ready", () => {
        this.redisReady = true
        this.logger.info("Redis cache connected for authorization context")
      })

      this.redis.on("error", (error) => {
        this.redisReady = false
        this.logger.error("Redis cache error", { error: error.message })
      })

      this.redis.connect().catch((error) => {
        this.logger.error("Redis cache connection failed, using fallback", {
          error: error.message,
        })
        this.redisReady = false
        this.redis?.disconnect()
        this.redis = undefined
      })
    }
  }

  static getInstance(): UserPermissionsCache {
    if (!UserPermissionsCache.instance) {
      UserPermissionsCache.instance = new UserPermissionsCache()
    }

    return UserPermissionsCache.instance
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (this.redis && this.redisReady) {
      await this.redis.set(key, JSON.stringify(value), "EX", ttlSeconds)
      return
    }

    this.fallbackCache.set(key, value, ttlSeconds)
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.redis && this.redisReady) {
      const cached = await this.redis.get(key)
      return cached ? (JSON.parse(cached) as T) : null
    }

    return this.fallbackCache.get(key)
  }

  async invalidate(key: string): Promise<void> {
    if (this.redis && this.redisReady) {
      await this.redis.del(key)
      return
    }

    this.fallbackCache.invalidate(key)
  }
}
