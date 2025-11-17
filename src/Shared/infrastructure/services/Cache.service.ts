export class CacheService {
  private static instance: CacheService
  private cache: Map<string, { data: any; expiry: number }> = new Map()

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

  get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key)

    if (!cached) {
      return null
    }

    if (cached.expiry < Date.now()) {
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
