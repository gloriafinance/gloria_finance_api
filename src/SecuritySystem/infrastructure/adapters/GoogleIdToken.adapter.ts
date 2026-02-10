import { createRemoteJWKSet, jwtVerify } from "jose"
import type { ISocialTokenAdapter, SocialTokenPayload } from "../../domain"
import { Logger } from "@/Shared/adapter"

type GoogleJwtPayload = {
  email?: string
  email_verified?: boolean
  name?: string
}

export class GoogleIdTokenAdapter implements ISocialTokenAdapter {
  private logger = Logger(GoogleIdTokenAdapter.name)

  async verifyIdToken(idToken: string): Promise<SocialTokenPayload> {
    const jwksUrl = new URL("https://www.googleapis.com/oauth2/v3/certs")
    const jwks = createRemoteJWKSet(jwksUrl)

    try {
      const { payload } = await jwtVerify(idToken, jwks, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
      })

      const data = payload as GoogleJwtPayload
      if (data.email_verified === false) {
        throw new Error("Google email not verified")
      }

      return {
        email: data.email ?? "",
        name: data.name,
      }
    } catch (error: any) {
      this.logger.error(
        "Google ID token verification failed. Falling back to tokeninfo.",
        error
      )
      const tokenInfo = await this.fetchTokenInfo(idToken)
      if (!tokenInfo) {
        throw error
      }

      if (tokenInfo.email_verified === "false") {
        throw new Error("Google email not verified")
      }

      return {
        email: tokenInfo.email ?? "",
      }
    }
  }

  private async fetchTokenInfo(token: string): Promise<{
    email?: string
    email_verified?: string
  } | null> {
    const url = new URL("https://oauth2.googleapis.com/tokeninfo")
    url.searchParams.set("access_token", token)

    const response = await fetch(url.toString())
    if (!response.ok) return null
    return (await response.json()) as {
      email?: string
      email_verified?: string
    }
  }
}
