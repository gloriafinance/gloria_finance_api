import { Logger } from "@/Shared/adapter"
import type { AIProviderConfigEntry } from "@/package/ai/helpers/AIProviderConfig.helper"
import {
  CodexOAuthError,
  CodexOAuthErrorCode,
} from "@/package/ai/auth/codex-oauth/CodexOAuthError"
import { resolveCodexOAuthConfig } from "@/package/ai/auth/codex-oauth/CodexOAuthConfig"
import { CodexProfileStore } from "@/package/ai/auth/codex-oauth/CodexProfileStore"
import { CodexTokenRefreshLock } from "@/package/ai/auth/codex-oauth/CodexTokenRefreshLock"
import { mapTokenEndpointResponseToTokenSet } from "@/package/ai/auth/codex-oauth/CodexTokenResponse.helper"
import type { CodexOAuthStoredProfile } from "@/package/ai/auth/codex-oauth/CodexOAuth.types"
import { CodexHTTPClient } from "@/package/ai/providers/codex/CodexHTTPClient"
import { maskCodexSecret } from "@/package/ai/providers/codex/helpers/MaskCodexSecret.helper"

export class CodexOAuthTokenManager {
  private static instance: CodexOAuthTokenManager | null = null

  private readonly logger = Logger(CodexOAuthTokenManager.name)
  private readonly stores = new Map<string, CodexProfileStore>()

  constructor(
    private readonly httpClient = new CodexHTTPClient(),
    private readonly lock = new CodexTokenRefreshLock()
  ) {}

  static getInstance(): CodexOAuthTokenManager {
    if (!this.instance) {
      this.instance = new CodexOAuthTokenManager()
    }
    return this.instance
  }

  async getValidAccessToken(
    profileId: string,
    providerCfg?: AIProviderConfigEntry
  ): Promise<string> {
    const profile = await this.getValidProfile(profileId, providerCfg)
    return profile.tokenSet.accessToken
  }

  async getValidProfile(
    profileId: string,
    providerCfg?: AIProviderConfigEntry
  ): Promise<CodexOAuthStoredProfile> {
    const config = resolveCodexOAuthConfig(providerCfg)
    const profile = this.store(config.storagePath).read(profileId)
    if (!profile) {
      throw new CodexOAuthError(
        CodexOAuthErrorCode.MISSING_PROFILE,
        `Missing OAuth profile '${profileId}' for provider 'codex'`
      )
    }

    if (!this.isExpiringSoon(profile, config.refreshSkewMs)) {
      return profile
    }

    return this.lock.runExclusive(
      `${config.storagePath}:${profile.profileId}`,
      async () => {
        const latest = this.store(config.storagePath).read(profile.profileId)
        if (!latest) {
          throw new CodexOAuthError(
            CodexOAuthErrorCode.MISSING_PROFILE,
            `Missing OAuth profile '${profile.profileId}' for provider 'codex'`
          )
        }

        if (!this.isExpiringSoon(latest, config.refreshSkewMs)) {
          return latest
        }

        return this.refreshProfile(profile.profileId, providerCfg)
      }
    )
  }

  async forceRefresh(
    profileId: string,
    providerCfg?: AIProviderConfigEntry
  ): Promise<CodexOAuthStoredProfile> {
    const config = resolveCodexOAuthConfig(providerCfg)
    return this.lock.runExclusive(`${config.storagePath}:${profileId}`, () =>
      this.refreshProfile(profileId, providerCfg)
    )
  }

  clearMemoryCache(
    profileId?: string,
    providerCfg?: AIProviderConfigEntry
  ): void {
    const config = resolveCodexOAuthConfig(providerCfg)
    this.store(config.storagePath).clearMemoryCache(profileId)
  }

  private async refreshProfile(
    profileId: string,
    providerCfg?: AIProviderConfigEntry
  ): Promise<CodexOAuthStoredProfile> {
    const config = resolveCodexOAuthConfig(providerCfg)
    const store = this.store(config.storagePath)
    const current = store.read(profileId)

    if (!current?.tokenSet?.refreshToken) {
      throw new CodexOAuthError(
        CodexOAuthErrorCode.NO_VALID_CREDENTIALS,
        `No valid refresh token for profile '${profileId}'`
      )
    }

    const response = await this.httpClient.postForm({
      url: config.tokenUrl,
      body: {
        grant_type: "refresh_token",
        refresh_token: current.tokenSet.refreshToken,
        client_id: config.clientId,
      },
    })

    if (!response.ok) {
      throw new CodexOAuthError(
        CodexOAuthErrorCode.REFRESH_FAILED,
        `Refresh failed with status ${response.status}`
      )
    }

    const tokenSet = mapTokenEndpointResponseToTokenSet(response.json, {
      previousRefreshToken: current.tokenSet.refreshToken,
      errorCode: CodexOAuthErrorCode.REFRESH_FAILED,
    })
    const saved = store.save(profileId, tokenSet)

    this.logger.info(
      `Codex OAuth refresh ok profile=${profileId} access=${maskCodexSecret(tokenSet.accessToken)} refresh=${maskCodexSecret(tokenSet.refreshToken)}`
    )

    return saved
  }

  private isExpiringSoon(
    profile: CodexOAuthStoredProfile,
    refreshSkewMs: number
  ): boolean {
    return profile.tokenSet.expiresAtUnixMs <= Date.now() + refreshSkewMs
  }

  private store(storagePath: string): CodexProfileStore {
    const existing = this.stores.get(storagePath)
    if (existing) return existing

    const created = new CodexProfileStore(storagePath)
    this.stores.set(storagePath, created)
    return created
  }
}
