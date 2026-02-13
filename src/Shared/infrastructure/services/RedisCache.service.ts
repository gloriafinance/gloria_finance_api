import Redis from "ioredis"

import { Logger } from "@/Shared/adapter"
import { type ICacheService } from "@/Shared/domain"

type CachePayload<T> = {
  value: T
}

export class RedisCacheService implements ICacheService {
  private static instance: RedisCacheService
  private readonly logger = Logger(RedisCacheService.name)
  private readonly client: Redis

  private constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT || 6379),
      username: process.env.REDIS_USER,
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    })
  }

  static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService()
    }

    return RedisCacheService.instance
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    await this.connectIfNeeded()

    const payload: CachePayload<any> = {
      value: value ?? null,
    }

    await this.client.set(key, JSON.stringify(payload), "EX", ttlSeconds)
  }

  async get<T>(key: string): Promise<T | null> {
    await this.connectIfNeeded()

    const raw = await this.client.get(key)

    if (!raw) {
      return null
    }

    try {
      const parsed = JSON.parse(raw) as CachePayload<T>
      return parsed.value ?? null
    } catch {
      return raw as T
    }
  }

  async invalidate(key: string): Promise<void> {
    await this.connectIfNeeded()
    await this.client.del(key)
  }

  invalidateByPrefix(prefix: string): void {
    void this.invalidateByPrefixAsync(prefix)
  }

  private async connectIfNeeded(): Promise<void> {
    if (this.client.status === "ready" || this.client.status === "connecting") {
      return
    }

    try {
      await this.client.connect()
    } catch (error) {
      this.logger.error("Redis cache connection failed", {
        error,
        status: this.client.status,
      })
    }
  }

  private async invalidateByPrefixAsync(prefix: string): Promise<void> {
    await this.connectIfNeeded()

    try {
      const keys = await this.scanKeys(`${prefix}*`)

      if (keys.length === 0) {
        return
      }

      await this.client.del(...keys)
    } catch (error) {
      this.logger.error("Redis cache invalidateByPrefix failed", {
        error,
        prefix,
      })
    }
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    let cursor = "0"
    const keys: string[] = []

    do {
      const [nextCursor, matchedKeys] = await this.client.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        "100"
      )

      cursor = nextCursor
      keys.push(...matchedKeys)
    } while (cursor !== "0")

    return keys
  }
}
