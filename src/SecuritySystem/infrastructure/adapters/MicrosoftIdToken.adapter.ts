import { createRemoteJWKSet, jwtVerify } from "jose"
import type { ISocialTokenAdapter, SocialTokenPayload } from "../../domain"

type MicrosoftJwtPayload = {
  email?: string
  preferred_username?: string
  upn?: string
  unique_name?: string
  name?: string
}

export class MicrosoftIdTokenAdapter implements ISocialTokenAdapter {
  async verifyIdToken(idToken: string): Promise<SocialTokenPayload> {
    const tenantId = process.env.MICROSOFT_TENANT_ID
    const clientId = process.env.MICROSOFT_CLIENT_ID

    if (!tenantId) {
      throw new Error("MICROSOFT_TENANT_ID is not configured")
    }
    if (!clientId) {
      throw new Error("MICROSOFT_CLIENT_ID is not configured")
    }

    const jwksUrl = new URL(
      `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`
    )
    const jwks = createRemoteJWKSet(jwksUrl)

    const issuer =
      process.env.MICROSOFT_ISSUER ??
      `https://login.microsoftonline.com/${tenantId}/v2.0`

    const { payload } = await jwtVerify(idToken, jwks, {
      issuer,
      audience: clientId,
    })

    const data = payload as MicrosoftJwtPayload
    const email =
      data.email ??
      data.preferred_username ??
      data.upn ??
      data.unique_name ??
      ""

    return {
      email,
      name: data.name,
    }
  }
}
