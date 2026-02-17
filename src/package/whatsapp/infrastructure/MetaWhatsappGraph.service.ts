import { createHmac } from "node:crypto"
import { GenericException } from "@/Shared/domain/exceptions/generic-exception"
import type {
  MetaDebugTokenData,
  MetaDebugTokenResponse,
  MetaErrorPayload,
  MetaMessagesResponse,
  MetaPhoneListResponse,
  MetaPhoneNumber,
  MetaTokenResponse,
  MetaWabaAccount,
  MetaWabaListResponse,
} from "@/package/whatsapp/domain"

export class MetaWhatsappGraphService {
  private readonly graphApiVersion =
    process.env.META_GRAPH_API_VERSION ?? "v18.0"

  async exchangeCodeForAccessToken(params: {
    code: string
    redirectUri: string
  }): Promise<{ accessToken: string; expiresIn?: number }> {
    const url = this.buildMetaUrl("/oauth/access_token", {
      client_id: this.metaAppId(),
      redirect_uri: params.redirectUri,
      client_secret: this.metaAppSecret(),
      code: params.code,
    })

    const data = await this.fetchMetaJson<MetaTokenResponse>(
      url,
      "token_exchange"
    )

    if (!data.access_token) {
      throw new GenericException(
        "Meta exchange error: access token was not returned by Meta"
      )
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    }
  }

  async inspectToken(accessToken: string): Promise<MetaDebugTokenData> {
    const url = this.buildMetaUrl("/debug_token", {
      input_token: accessToken,
      access_token: `${this.metaAppId()}|${this.metaAppSecret()}`,
    })

    const data = await this.fetchMetaJson<MetaDebugTokenResponse>(
      url,
      "debug_token"
    )
    return data.data ?? {}
  }

  async listWhatsappBusinessAccounts(
    accessToken: string
  ): Promise<MetaWabaAccount[]> {
    const url = this.buildMetaUrl("/me/whatsapp_business_accounts", {
      access_token: accessToken,
      appsecret_proof: this.createAppSecretProof(accessToken),
    })

    const data = await this.fetchMetaJson<MetaWabaListResponse>(
      url,
      "waba_accounts"
    )
    return Array.isArray(data.data) ? data.data : []
  }

  async listPhoneNumbers(
    accessToken: string,
    wabaId: string
  ): Promise<MetaPhoneNumber[]> {
    const url = this.buildMetaUrl(`/${wabaId}/phone_numbers`, {
      access_token: accessToken,
      appsecret_proof: this.createAppSecretProof(accessToken),
    })

    const data = await this.fetchMetaJson<MetaPhoneListResponse>(
      url,
      "phone_numbers"
    )
    return Array.isArray(data.data) ? data.data : []
  }

  async rotateAccessToken(accessToken: string): Promise<string> {
    const expiringTokenUrl = this.buildMetaUrl("/oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: this.metaAppId(),
      client_secret: this.metaAppSecret(),
      set_token_expires_in_60_days: "true",
      fb_exchange_token: accessToken,
    })

    try {
      const expiringTokenData = await this.fetchMetaJson<MetaTokenResponse>(
        expiringTokenUrl,
        "refresh_token"
      )
      if (expiringTokenData.access_token) {
        return expiringTokenData.access_token
      }
    } catch {
      // Fallback for non-system-user or flows where set_token_expires_in_60_days is not accepted.
    }

    const genericRefreshUrl = this.buildMetaUrl("/oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: this.metaAppId(),
      client_secret: this.metaAppSecret(),
      fb_exchange_token: accessToken,
    })

    const data = await this.fetchMetaJson<MetaTokenResponse>(
      genericRefreshUrl,
      "refresh_token_fallback"
    )

    if (!data.access_token) {
      throw new GenericException(
        "Meta refresh token error: access token was not returned by Meta"
      )
    }

    return data.access_token
  }

  async sendTextMessage(params: {
    accessToken: string
    phoneNumberId: string
    to: string
    body: string
    previewUrl?: boolean
  }): Promise<{ messageId?: string }> {
    const url = this.buildMetaUrl(`/${params.phoneNumberId}/messages`, {})
    const response = await this.fetchMetaJson<MetaMessagesResponse>(
      url,
      "send_text_message",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: params.to,
          type: "text",
          text: {
            body: params.body,
            preview_url: params.previewUrl ?? false,
          },
        }),
      }
    )

    return {
      messageId: response.messages?.[0]?.id,
    }
  }

  private metaAppId(): string {
    const appId = process.env.META_APP_ID
    const appSecret = process.env.META_APP_SECRET
    if (!appId || !appSecret) {
      throw new GenericException(
        "Meta App ID or Secret not configured in server environment"
      )
    }
    return appId
  }

  private metaAppSecret(): string {
    const appSecret = process.env.META_APP_SECRET
    if (!appSecret) {
      throw new GenericException(
        "Meta App ID or Secret not configured in server environment"
      )
    }
    return appSecret
  }

  private buildMetaUrl(path: string, params: Record<string, string>): string {
    const query = new URLSearchParams(params).toString()
    return `https://graph.facebook.com/${this.graphApiVersion}${path}?${query}`
  }

  private createAppSecretProof(accessToken: string): string {
    return createHmac("sha256", this.metaAppSecret())
      .update(accessToken)
      .digest("hex")
  }

  private async fetchMetaJson<T>(
    url: string,
    operation: string,
    init?: RequestInit
  ): Promise<T & MetaErrorPayload> {
    let response: Response

    try {
      response = await fetch(url, init)
    } catch {
      throw new GenericException(
        `Meta ${operation} error: failed to reach Meta Graph API`
      )
    }

    let data: (T & MetaErrorPayload) | undefined
    try {
      const rawData: unknown = await response.json()
      data =
        rawData && typeof rawData === "object"
          ? (rawData as T & MetaErrorPayload)
          : undefined
    } catch {
      data = undefined
    }

    if (!response.ok || data?.error) {
      const message =
        data?.error?.message ||
        `HTTP ${response.status} ${response.statusText || "Unknown error"}`
      throw new GenericException(`Meta ${operation} error: ${message}`)
    }

    return (data || ({} as T & MetaErrorPayload)) as T & MetaErrorPayload
  }
}
