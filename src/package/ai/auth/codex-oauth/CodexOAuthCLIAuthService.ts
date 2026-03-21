import { Logger } from "@/Shared/adapter"
import type { AIProviderConfigEntry } from "@/package/ai/helpers/AIProviderConfig.helper"
import {
  generateCodeChallenge,
  generateCodeVerifier,
  generateRandomState,
} from "@/package/ai/auth/codex-oauth/CodexPKCE.helper"
import {
  CodexOAuthError,
  CodexOAuthErrorCode,
} from "@/package/ai/auth/codex-oauth/CodexOAuthError"
import { resolveCodexOAuthConfig } from "@/package/ai/auth/codex-oauth/CodexOAuthConfig"
import { CodexProfileStore } from "@/package/ai/auth/codex-oauth/CodexProfileStore"
import type {
  CodexAuthorizationSession,
  CodexOAuthProfileStatus,
  CodexOAuthStoredProfile,
} from "@/package/ai/auth/codex-oauth/CodexOAuth.types"
import { mapTokenEndpointResponseToTokenSet } from "@/package/ai/auth/codex-oauth/CodexTokenResponse.helper"
import { CodexHTTPClient } from "@/package/ai/providers/codex/CodexHTTPClient"
import { maskCodexSecret } from "@/package/ai/providers/codex/helpers/MaskCodexSecret.helper"
import { extractCodexAccountId } from "@/package/ai/providers/codex/helpers/ExtractCodexAccountId.helper"

export class CodexOAuthCLIAuthService {
  private readonly logger = Logger(CodexOAuthCLIAuthService.name)
  private readonly stores = new Map<string, CodexProfileStore>()

  constructor(private readonly httpClient = new CodexHTTPClient()) {}

  createAuthorizationSession(
    providerCfg?: AIProviderConfigEntry
  ): CodexAuthorizationSession {
    const config = resolveCodexOAuthConfig(providerCfg)
    const codeVerifier = generateCodeVerifier()
    const codeChallenge = generateCodeChallenge(codeVerifier)
    const state = generateRandomState()

    const authorizationUrl = new URL(config.authorizeUrl)
    authorizationUrl.searchParams.set("response_type", "code")
    authorizationUrl.searchParams.set("client_id", config.clientId)
    authorizationUrl.searchParams.set("redirect_uri", config.redirectUri)
    authorizationUrl.searchParams.set("scope", config.scopes.join(" "))
    authorizationUrl.searchParams.set("state", state)
    authorizationUrl.searchParams.set("code_challenge", codeChallenge)
    authorizationUrl.searchParams.set("code_challenge_method", "S256")

    return {
      codeVerifier,
      codeChallenge,
      state,
      authorizationUrl: authorizationUrl.toString(),
      redirectUri: config.redirectUri,
    }
  }

  async exchangeAuthorizationCode(params: {
    profileId: string
    authorizationCode: string
    session: CodexAuthorizationSession
    providerCfg?: AIProviderConfigEntry
  }): Promise<CodexOAuthStoredProfile> {
    const code = params.authorizationCode.trim()
    if (!code) {
      throw new CodexOAuthError(
        CodexOAuthErrorCode.INVALID_AUTH_CODE,
        "Authorization code is required"
      )
    }

    const config = resolveCodexOAuthConfig(params.providerCfg)
    const response = await this.httpClient.postForm({
      url: config.tokenUrl,
      body: {
        grant_type: "authorization_code",
        code,
        redirect_uri: params.session.redirectUri,
        client_id: config.clientId,
        code_verifier: params.session.codeVerifier,
      },
    })

    if (!response.ok) {
      throw new CodexOAuthError(
        CodexOAuthErrorCode.TOKEN_EXCHANGE_FAILED,
        `Authorization code exchange failed with status ${response.status}`
      )
    }

    const tokenSet = mapTokenEndpointResponseToTokenSet(response.json)
    const profile = this.store(config.storagePath).save(
      params.profileId,
      tokenSet
    )

    this.logger.info(
      `Codex OAuth login saved profile=${profile.profileId} access=${maskCodexSecret(tokenSet.accessToken)} refresh=${maskCodexSecret(tokenSet.refreshToken)}`
    )

    return profile
  }

  getStatus(
    profileId: string,
    providerCfg?: AIProviderConfigEntry
  ): CodexOAuthProfileStatus {
    const config = resolveCodexOAuthConfig(providerCfg)
    const profile = this.store(config.storagePath).read(profileId)
    if (!profile) {
      return {
        exists: false,
        isExpired: true,
        isExpiringSoon: false,
      }
    }

    const now = Date.now()
    return {
      exists: true,
      isExpired: profile.tokenSet.expiresAtUnixMs <= now,
      isExpiringSoon:
        profile.tokenSet.expiresAtUnixMs <= now + config.refreshSkewMs,
      expiresAtUnixMs: profile.tokenSet.expiresAtUnixMs,
      account: {
        ...profile.tokenSet.account,
        chatgptAccountId:
          profile.tokenSet.account?.chatgptAccountId ??
          extractCodexAccountId(profile.tokenSet.accessToken),
      },
    }
  }

  listProfiles(providerCfg?: AIProviderConfigEntry): string[] {
    const config = resolveCodexOAuthConfig(providerCfg)
    return this.store(config.storagePath).listProfiles()
  }

  logout(profileId: string, providerCfg?: AIProviderConfigEntry): boolean {
    const config = resolveCodexOAuthConfig(providerCfg)
    return this.store(config.storagePath).delete(profileId)
  }

  private store(storagePath: string): CodexProfileStore {
    const existing = this.stores.get(storagePath)
    if (existing) return existing

    const created = new CodexProfileStore(storagePath)
    this.stores.set(storagePath, created)
    return created
  }
}
