export interface ICacheService {
  set(key: string, value: any, ttlSeconds: number): Promise<void>

  get<T>(key: string): Promise<T | null>

  invalidate(key: string): Promise<void>

  invalidateByPrefix(prefix: string): void
}
