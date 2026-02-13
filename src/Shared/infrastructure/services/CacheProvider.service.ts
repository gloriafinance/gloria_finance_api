import type { ICacheService } from "@/Shared/domain"

import { CacheService } from "./Cache.service"
import { RedisCacheService } from "./RedisCache.service"

export class CacheProviderService {
  private static instance: ICacheService

  static getInstance(): ICacheService {
    if (!CacheProviderService.instance) {
      const cacheDriver = (process.env.CACHE_DRIVER || "memory").toLowerCase()

      CacheProviderService.instance =
        cacheDriver === "redis"
          ? RedisCacheService.getInstance()
          : CacheService.getInstance()
    }

    return CacheProviderService.instance
  }
}
