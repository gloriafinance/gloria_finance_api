import Redis from "ioredis"

import { Logger } from "@/Shared/adapter"
import { type ICacheService } from "@/Shared/domain"
import { readRedisConnectionOptions } from "@/Shared/helpers/ReadRedisConnectionOptions.helper"

type CachePayload<T> = {
  value: T
}

export class RedisCacheService implements ICacheService {
  private static instance: RedisCacheService
  private readonly logger = Logger(RedisCacheService.name)
  private readonly client: Redis
  private connectPromise?: Promise<boolean>

  private constructor() {
    this.client = new Redis({
      ...readRedisConnectionOptions(),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    })
    this.bindClientEvents()
  }

  static getInstance(): RedisCacheService {
    if (!RedisCacheService.instance) {
      RedisCacheService.instance = new RedisCacheService()
    }

    return RedisCacheService.instance
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    const connected = await this.connectIfNeeded()
    if (!connected) return

    const payload: CachePayload<any> = {
      value: value ?? null,
    }

    try {
      await this.client.set(key, JSON.stringify(payload), "EX", ttlSeconds)
    } catch (error) {
      this.logger.error("Redis cache set failed", {
        key,
        error,
        status: this.client.status,
      })
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const connected = await this.connectIfNeeded()
    if (!connected) return null

    let raw: string | null
    try {
      raw = await this.client.get(key)
    } catch (error) {
      this.logger.error("Redis cache get failed", {
        key,
        error,
        status: this.client.status,
      })
      return null
    }

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
    const connected = await this.connectIfNeeded()
    if (!connected) return

    try {
      await this.client.del(key)
    } catch (error) {
      this.logger.error("Redis cache invalidate failed", {
        key,
        error,
        status: this.client.status,
      })
    }
  }

  invalidateByPrefix(prefix: string): void {
    void this.invalidateByPrefixAsync(prefix)
  }

  private async connectIfNeeded(): Promise<boolean> {
    if (this.client.status === "ready") {
      return true
    }

    if (
      this.client.status === "connecting" ||
      this.client.status === "reconnecting"
    ) {
      return this.waitUntilReady()
    }

    if (this.connectPromise) {
      return this.connectPromise
    }

    this.connectPromise = this.connectAndWait()

    try {
      return await this.connectPromise
    } catch (error) {
      this.logger.error("Redis cache connection failed", {
        error,
        status: this.client.status,
      })
      return false
    } finally {
      this.connectPromise = undefined
    }
  }

  private async invalidateByPrefixAsync(prefix: string): Promise<void> {
    const connected = await this.connectIfNeeded()
    if (!connected) return

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
        status: this.client.status,
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

  private bindClientEvents(): void {
    this.client.on("error", (error) => {
      this.logger.error("Redis cache client error", {
        error,
        status: this.client.status,
      })
    })
  }

  private async connectAndWait(): Promise<boolean> {
    if (this.client.status === "ready") {
      return true
    }

    if (
      this.client.status === "wait" ||
      this.client.status === "end" ||
      this.client.status === "close"
    ) {
      await this.client.connect()
    }

    if (
      this.client.status === "connect" ||
      this.client.status === "connecting" ||
      this.client.status === "reconnecting"
    ) {
      return this.waitUntilReady()
    }

    return false
  }

  private async waitUntilReady(timeoutMs: number = 10000): Promise<boolean> {
    if (this.client.status === "ready") {
      return true
    }

    return await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        cleanup()
        resolve(String(this.client.status) === "ready")
      }, timeoutMs)

      const onReady = () => {
        cleanup()
        resolve(true)
      }

      const onEnd = () => {
        cleanup()
        resolve(false)
      }

      const cleanup = () => {
        clearTimeout(timeout)
        this.client.off("ready", onReady)
        this.client.off("end", onEnd)
      }

      this.client.on("ready", onReady)
      this.client.on("end", onEnd)
    })
  }
}
