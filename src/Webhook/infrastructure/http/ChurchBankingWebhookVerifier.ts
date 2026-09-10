import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
} from "jose"
import { createHash } from "node:crypto"

const CLOCK_TOLERANCE_SECONDS = 5
const MAX_TOKEN_LIFETIME_SECONDS = 300
const JWKS_CACHE_MS = 5 * 60 * 1000
const EXPECTED_ISSUER = "CHURCH_BANKING"

type HeaderValue = string | string[] | undefined
type ResolverFactory = (url: URL) => JWTVerifyGetKey

export type ChurchBankingWebhookVerificationInput = {
  readonly authorization: HeaderValue
  readonly method: string
  readonly path: string
  readonly rawBody?: Uint8Array
}

export class ChurchBankingWebhookVerificationError extends Error {
  constructor(
    readonly status: 400 | 401 | 503,
    readonly code: string
  ) {
    super(code)
    this.name = ChurchBankingWebhookVerificationError.name
  }
}

export class ChurchBankingWebhookVerifier {
  private resolver?: { readonly url: string; readonly value: JWTVerifyGetKey }

  constructor(
    private readonly resolverFactory: ResolverFactory = (url) =>
      createRemoteJWKSet(url, {
        cacheMaxAge: JWKS_CACHE_MS,
        cooldownDuration: 30_000,
        timeoutDuration: 5_000,
      })
  ) {}

  async verify(input: ChurchBankingWebhookVerificationInput): Promise<void> {
    if (input.rawBody === undefined) {
      throw new ChurchBankingWebhookVerificationError(
        503,
        "CHURCH_BANKING_WEBHOOK_RAW_BODY_UNAVAILABLE"
      )
    }

    const token = bearerToken(input.authorization)
    const config = this.config()

    try {
      const verified = await jwtVerify(token, this.keyFor(config.jwksUrl), {
        algorithms: ["ES256"],
        issuer: EXPECTED_ISSUER,
        audience: config.audience,
        clockTolerance: CLOCK_TOLERANCE_SECONDS,
      })

      if (
        typeof verified.protectedHeader.kid !== "string" ||
        verified.protectedHeader.kid.trim() === ""
      ) {
        throw unauthorized()
      }

      const now = Math.floor(Date.now() / 1000)
      const payload = verified.payload

      if (
        typeof payload.jti !== "string" ||
        payload.jti.trim() === "" ||
        typeof payload.iat !== "number" ||
        typeof payload.exp !== "number" ||
        payload.exp <= payload.iat ||
        payload.exp - payload.iat > MAX_TOKEN_LIFETIME_SECONDS ||
        payload.iat > now + CLOCK_TOLERANCE_SECONDS ||
        payload.method !== "POST" ||
        payload.method !== input.method.toUpperCase() ||
        payload.path !== input.path ||
        typeof payload.bodyHash !== "string" ||
        payload.bodyHash.trim() === ""
      ) {
        throw unauthorized()
      }

      const bodyHash = createHash("sha256")
        .update(input.rawBody)
        .digest("base64url")

      if (payload.bodyHash !== bodyHash) {
        throw new ChurchBankingWebhookVerificationError(
          400,
          "CHURCH_BANKING_WEBHOOK_BODY_HASH_INVALID"
        )
      }
    } catch (error) {
      if (error instanceof ChurchBankingWebhookVerificationError) throw error

      if (isKeyAvailabilityError(error)) {
        throw new ChurchBankingWebhookVerificationError(
          503,
          "CHURCH_BANKING_WEBHOOK_KEY_UNAVAILABLE"
        )
      }

      throw unauthorized()
    }
  }

  private config(): { readonly jwksUrl: URL; readonly audience: string } {
    const baseUrl = process.env.CHURCH_BANKING_BASE_URL?.replace(/\/$/, "")
    const audience = process.env.CHURCH_BANKING_CLIENT_CODE

    if (!baseUrl || !audience) {
      throw new ChurchBankingWebhookVerificationError(
        503,
        "CHURCH_BANKING_WEBHOOK_CONFIGURATION_INVALID"
      )
    }

    try {
      return {
        jwksUrl: new URL("/.well-known/jwks.json", `${baseUrl}/`),
        audience,
      }
    } catch {
      throw new ChurchBankingWebhookVerificationError(
        503,
        "CHURCH_BANKING_WEBHOOK_CONFIGURATION_INVALID"
      )
    }
  }

  private keyFor(url: URL): JWTVerifyGetKey {
    const href = url.href
    if (this.resolver?.url === href) return this.resolver.value

    const value = this.resolverFactory(url)
    this.resolver = { url: href, value }
    return value
  }
}

function bearerToken(value: HeaderValue): string {
  if (Array.isArray(value) || typeof value !== "string") throw unauthorized()

  const match = /^Bearer\s+(.+)$/i.exec(value.trim())
  if (!match?.[1]) throw unauthorized()

  return match[1]
}

function unauthorized(): ChurchBankingWebhookVerificationError {
  return new ChurchBankingWebhookVerificationError(
    401,
    "CHURCH_BANKING_WEBHOOK_UNAUTHORIZED"
  )
}

function isKeyAvailabilityError(error: unknown): boolean {
  if (
    error instanceof errors.JWKSTimeout ||
    error instanceof errors.JWKSInvalid ||
    error instanceof TypeError
  ) {
    return true
  }

  return error instanceof errors.JOSEError && error.code === "ERR_JOSE_GENERIC"
}

export const churchBankingWebhookVerifier = new ChurchBankingWebhookVerifier()
