import {
  BaseServerModule,
  type ServerApp,
  type ServerContext,
} from "bun-platform-kit"

export type RateLimitOptions = {
  windowMs?: number
  limit?: number
  max?: number
  standardHeaders?: boolean
  legacyHeaders?: boolean
  message?: string | Record<string, unknown>
  excludePaths?: string[]
}

type HitBucket = {
  count: number
  expiresAt: number
}

const shouldSkipPath = (path: string, excludePaths: string[]): boolean => {
  for (const excluded of excludePaths) {
    if (path === excluded || path.startsWith(`${excluded}/`)) {
      return true
    }
  }
  return false
}

const createRateLimitMiddleware = (options?: Partial<RateLimitOptions>) => {
  const windowMs =
    typeof options?.windowMs === "number" ? options.windowMs : 8 * 60 * 1000
  const configuredLimit = options?.limit ?? options?.max
  const limit = typeof configuredLimit === "number" ? configuredLimit : 100
  const excludePaths = options?.excludePaths ?? []
  const hits = new Map<string, HitBucket>()

  return (req: any, res: any, next: () => void) => {
    const path = String(req?.path ?? req?.originalUrl ?? "")
    if (excludePaths.length > 0 && shouldSkipPath(path, excludePaths)) {
      next()
      return
    }

    const key = req.ip || String(req.headers?.["x-forwarded-for"] || "unknown")
    const now = Date.now()
    const existing = hits.get(key)

    if (!existing || existing.expiresAt <= now) {
      hits.set(key, { count: 1, expiresAt: now + windowMs })
    } else {
      existing.count += 1
    }

    const current = hits.get(key)!
    const remaining = Math.max(0, limit - current.count)

    if (options?.standardHeaders) {
      res.set("ratelimit-limit", String(limit))
      res.set("ratelimit-remaining", String(remaining))
      res.set("ratelimit-reset", String(Math.ceil(current.expiresAt / 1000)))
    }

    if (current.count > limit) {
      const message =
        typeof options?.message === "string" ||
        (typeof options?.message === "object" && options?.message)
          ? options.message
          : undefined

      res.status(429).json(
        message || {
          message: "Too many requests, please try again later.",
        }
      )
      return
    }

    next()
  }
}

export class RateLimitModule extends BaseServerModule {
  name = "RateLimit"
  override priority = -70

  constructor(private readonly limiterOptions?: Partial<RateLimitOptions>) {
    super()
  }

  getModuleName(): string {
    return this.name
  }

  init(app: ServerApp, _context?: ServerContext): void {
    app.use(createRateLimitMiddleware(this.limiterOptions))
  }
}
