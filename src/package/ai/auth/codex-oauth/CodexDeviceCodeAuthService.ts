import { Logger } from "@/Shared/adapter"
import type { AIProviderConfigEntry } from "@/package/ai/helpers/AIProviderConfig.helper"
import { resolveCodexOAuthConfig } from "@/package/ai/auth/codex-oauth/CodexOAuthConfig"
import {
  CodexOAuthError,
  CodexOAuthErrorCode,
} from "@/package/ai/auth/codex-oauth/CodexOAuthError"
import type {
  CodexDeviceCodeSession,
  CodexOAuthStoredProfile,
} from "@/package/ai/auth/codex-oauth/CodexOAuth.types"
import { CodexProfileStore } from "@/package/ai/auth/codex-oauth/CodexProfileStore"
import { mapTokenEndpointResponseToTokenSet } from "@/package/ai/auth/codex-oauth/CodexTokenResponse.helper"
import { CodexHTTPClient } from "@/package/ai/providers/codex/CodexHTTPClient"
import { maskCodexSecret } from "@/package/ai/providers/codex/helpers/MaskCodexSecret.helper"

type DeviceUserCodeResponse = {
  device_auth_id?: string
  user_code?: string
  usercode?: string
  interval?: string | number
}

type DeviceTokenPollResponse = {
  authorization_code?: string
  code_verifier?: string
}

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export class CodexDeviceCodeAuthService {
  private readonly logger = Logger(CodexDeviceCodeAuthService.name)
  private readonly stores = new Map<string, CodexProfileStore>()

  constructor(private readonly httpClient = new CodexHTTPClient()) {}

  async start(
    providerCfg?: AIProviderConfigEntry
  ): Promise<CodexDeviceCodeSession> {
    const config = resolveCodexOAuthConfig(providerCfg)
    const response = await this.httpClient.postJson<DeviceUserCodeResponse>({
      url: `${config.issuer}/api/accounts/deviceauth/usercode`,
      body: { client_id: config.clientId },
    })

    if (!response.ok) {
      throw new CodexOAuthError(
        CodexOAuthErrorCode.TOKEN_EXCHANGE_FAILED,
        `Device code request failed with status ${response.status}`
      )
    }

    const deviceAuthId = response.json.device_auth_id?.trim()
    const userCode =
      response.json.user_code?.trim() ?? response.json.usercode?.trim()
    const intervalSeconds = Math.max(Number(response.json.interval ?? 5), 1)

    if (!deviceAuthId || !userCode) {
      throw new CodexOAuthError(
        CodexOAuthErrorCode.TOKEN_EXCHANGE_FAILED,
        "Device code response missing device_auth_id or user_code"
      )
    }

    return {
      verificationUrl: `${config.issuer}/codex/device`,
      userCode,
      deviceAuthId,
      intervalSeconds,
      redirectUri: `${config.issuer}/deviceauth/callback`,
      clientId: config.clientId,
      issuer: config.issuer,
    }
  }

  async complete(params: {
    profileId: string
    session: CodexDeviceCodeSession
    providerCfg?: AIProviderConfigEntry
    timeoutMs?: number
  }): Promise<CodexOAuthStoredProfile> {
    const config = resolveCodexOAuthConfig(params.providerCfg)
    const timeoutMs = params.timeoutMs ?? 15 * 60 * 1000
    const startedAt = Date.now()

    while (true) {
      const pollResponse =
        await this.httpClient.postJson<DeviceTokenPollResponse>({
          url: `${config.issuer}/api/accounts/deviceauth/token`,
          body: {
            device_auth_id: params.session.deviceAuthId,
            user_code: params.session.userCode,
          },
        })

      if (pollResponse.ok) {
        const authorizationCode = pollResponse.json.authorization_code?.trim()
        const codeVerifier = pollResponse.json.code_verifier?.trim()

        if (!authorizationCode || !codeVerifier) {
          throw new CodexOAuthError(
            CodexOAuthErrorCode.TOKEN_EXCHANGE_FAILED,
            "Device code authorization response missing authorization_code/code_verifier"
          )
        }

        const exchangeResponse = await this.httpClient.postForm({
          url: config.tokenUrl,
          body: {
            grant_type: "authorization_code",
            code: authorizationCode,
            redirect_uri: params.session.redirectUri,
            client_id: params.session.clientId,
            code_verifier: codeVerifier,
          },
        })

        if (!exchangeResponse.ok) {
          throw new CodexOAuthError(
            CodexOAuthErrorCode.TOKEN_EXCHANGE_FAILED,
            `Device code exchange failed with status ${exchangeResponse.status}`
          )
        }

        const tokenSet = mapTokenEndpointResponseToTokenSet(
          exchangeResponse.json
        )
        const profile = this.store(config.storagePath).save(
          params.profileId,
          tokenSet
        )

        this.logger.info(
          `Codex device-code login saved profile=${profile.profileId} access=${maskCodexSecret(tokenSet.accessToken)} refresh=${maskCodexSecret(tokenSet.refreshToken)}`
        )
        return profile
      }

      if (pollResponse.status !== 403 && pollResponse.status !== 404) {
        throw new CodexOAuthError(
          CodexOAuthErrorCode.TOKEN_EXCHANGE_FAILED,
          `Device auth failed with status ${pollResponse.status}`
        )
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new CodexOAuthError(
          CodexOAuthErrorCode.TOKEN_EXCHANGE_FAILED,
          "Device auth timed out after 15 minutes"
        )
      }

      await sleep(params.session.intervalSeconds * 1000)
    }
  }

  private store(storagePath: string): CodexProfileStore {
    const existing = this.stores.get(storagePath)
    if (existing) return existing

    const created = new CodexProfileStore(storagePath)
    this.stores.set(storagePath, created)
    return created
  }
}
