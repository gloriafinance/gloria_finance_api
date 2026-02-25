type RedisTlsOptions = {
  servername: string
}

export type RedisConnectionOptions = {
  host: string
  port: number
  username?: string
  password?: string
  tls?: RedisTlsOptions
}

const normalizeOptionalValue = (value?: string): string | undefined => {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const parseBoolean = (value?: string): boolean => {
  return (
    String(value || "")
      .trim()
      .toLowerCase() === "true"
  )
}

const parsePort = (value: string, source: string): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${source} must be a valid number`)
  }
  return parsed
}

const parseFromRedisUrl = (redisUrl: string): RedisConnectionOptions => {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(redisUrl)
  } catch {
    throw new Error("REDIS_URL is invalid")
  }

  if (parsedUrl.protocol !== "redis:" && parsedUrl.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use redis:// or rediss:// protocol")
  }

  const host = normalizeOptionalValue(parsedUrl.hostname)
  if (!host) {
    throw new Error("REDIS_URL must include a host")
  }

  const username = normalizeOptionalValue(
    parsedUrl.username
      ? decodeURIComponent(parsedUrl.username)
      : process.env.REDIS_USER
  )
  const password = normalizeOptionalValue(
    parsedUrl.password
      ? decodeURIComponent(parsedUrl.password)
      : process.env.REDIS_PASSWORD
  )
  const port = parsedUrl.port
    ? parsePort(parsedUrl.port, "REDIS_URL port")
    : 6379

  return {
    host,
    port,
    username,
    password,
    ...(parsedUrl.protocol === "rediss:" ? { tls: { servername: host } } : {}),
  }
}

export const readRedisConnectionOptions = (): RedisConnectionOptions => {
  const redisUrl = normalizeOptionalValue(process.env.REDIS_URL)
  if (redisUrl) {
    return parseFromRedisUrl(redisUrl)
  }

  const host = normalizeOptionalValue(process.env.REDIS_HOST)
  if (!host) {
    throw new Error("Missing REDIS_HOST (or set REDIS_URL)")
  }

  const port = parsePort(process.env.REDIS_PORT || "6379", "REDIS_PORT")

  return {
    host,
    port,
    username: normalizeOptionalValue(process.env.REDIS_USER),
    password: normalizeOptionalValue(process.env.REDIS_PASSWORD),
    ...(parseBoolean(process.env.REDIS_TLS)
      ? { tls: { servername: host } }
      : {}),
  }
}
