import { type ICacheService } from "@/Shared/domain"

export class CacheService implements ICacheService {
  private static instance: CacheService
  private static readonly STORE_KEY = "__gloria_finance_cache_store__"
  private cache: Map<string, { data: any; expiry: number }>

  private constructor() {
    const globalState = globalThis as typeof globalThis & {
      [CacheService.STORE_KEY]?: Map<string, { data: any; expiry: number }>
    }

    if (!globalState[CacheService.STORE_KEY]) {
      globalState[CacheService.STORE_KEY] = new Map()
    }

    this.cache = globalState[CacheService.STORE_KEY]!
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }

    return CacheService.instance
  }

  async set(key: string, value: any, ttlSeconds: number): Promise<void> {
    const expiry = Date.now() + ttlSeconds * 1000
    this.cache.set(key, { data: value, expiry })
  }

  async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key)

    if (!cached) {
      return null
    }

    if (cached.expiry <= Date.now()) {
      this.cache.delete(key)
      return null
    }

    return cached.data
  }

  async invalidate(key: string): Promise<void> {
    this.cache.delete(key)
  }

  invalidateByPrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
      }
    }
  }
}
