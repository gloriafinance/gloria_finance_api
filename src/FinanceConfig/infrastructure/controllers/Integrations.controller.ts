import { HttpStatus } from "@/Shared/domain"
import { GenericException } from "@/Shared/domain/exceptions/generic-exception"
import domainResponse from "../../../Shared/helpers/domainResponse"
import { SetWhatsappCredentials } from "@/Church/applications"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  type ServerResponse,
  Use,
} from "bun-platform-kit"
import {
  type AuthenticatedRequest,
  PermissionMiddleware,
} from "@/Shared/infrastructure"
import { Logger } from "@/Shared/adapter"
import { createHmac } from "node:crypto"

type MetaErrorPayload = {
  error?: {
    message?: string
    type?: string
    code?: number
    error_subcode?: number
    fbtrace_id?: string
  }
}

type MetaDebugTokenResponse = {
  data?: {
    granular_scopes?: Array<{
      scope?: string
      target_ids?: string[]
    }>
  }
}

type MetaWabaListResponse = {
  data?: Array<{
    id?: string
    name?: string
  }>
}

type MetaPhoneListResponse = {
  data?: Array<{
    id?: string
    display_phone_number?: string
  }>
}

type MetaTokenResponse = {
  access_token?: string
}

@Controller("/api/v1/integrations")
export class IntegrationsController {
  private logger = Logger(IntegrationsController.name)
  private graphApiVersion = process.env.META_GRAPH_API_VERSION ?? "v18.0"

  @Post("/whatsapp")
  //@Use([PermissionMiddleware, Can("church", "upsert")])
  @Use([PermissionMiddleware])
  async setWhatsappCredentials(
    @Body()
    body: {
      code?: string
      redirectUri?: string
    },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    const code = typeof body?.code === "string" ? body.code.trim() : ""
    const redirectUri =
      typeof body?.redirectUri === "string" ? body.redirectUri.trim() : ""

    this.logger.info("Received request to exchange WhatsApp code", {
      code: code ? "***" : "MISSING",
      redirectUri: redirectUri || "MISSING",
    })

    try {
      if (!code || !redirectUri) {
        throw new GenericException(
          "Fields `code` and `redirectUri` are required"
        )
      }

      const appId = process.env.META_APP_ID
      const appSecret = process.env.META_APP_SECRET

      if (!appId || !appSecret) {
        this.logger.error("Meta configuration missing", {
          appId: !!appId,
          appSecret: !!appSecret,
        })
        throw new GenericException(
          "Meta App ID or Secret not configured in server environment"
        )
      }

      const accessToken = await this.exchangeCodeForAccessToken({
        appId,
        appSecret,
        code,
        redirectUri,
      })
      this.logger.info("Step 1 Success: Token obtained")

      const wabaIds = await this.resolveWabaIds(accessToken, appId, appSecret)
      const { wabaId, phoneNumberId } = await this.resolvePhoneNumber({
        accessToken,
        wabaIds,
        appSecret,
      })

      // 4. Save to Database
      this.logger.info(
        `Step 4: Saving credentials to DB for church ${req.auth.churchId}...`
      )
      await new SetWhatsappCredentials(
        ChurchMongoRepository.getInstance()
      ).execute(req.auth.churchId, wabaId, phoneNumberId, accessToken)

      this.logger.info(
        "Step 4 Success: WhatsApp credentials saved successfully"
      )

      res.status(HttpStatus.OK).send({
        message: "WhatsApp connected and credentials saved successfully",
        wabaId,
        phoneNumberId,
      })
    } catch (e: any) {
      this.logger.error("WhatsApp setup flow failed", e)
      domainResponse(e, res)
    }
  }

  private async exchangeCodeForAccessToken(params: {
    appId: string
    appSecret: string
    code: string
    redirectUri: string
  }): Promise<string> {
    this.logger.info("Step 1: Exchanging code for Access Token...")
    const exchangeUrl = this.buildMetaUrl("/oauth/access_token", {
      client_id: params.appId,
      redirect_uri: params.redirectUri,
      client_secret: params.appSecret,
      code: params.code,
    })

    const tokenData = await this.fetchMetaJson<MetaTokenResponse>(
      exchangeUrl,
      "token_exchange"
    )
    const accessToken = tokenData.access_token

    if (!accessToken) {
      throw new GenericException(
        "Meta exchange error: access token was not returned by Meta"
      )
    }

    return accessToken
  }

  private async resolveWabaIds(
    accessToken: string,
    appId: string,
    appSecret: string
  ): Promise<string[]> {
    this.logger.info("Step 2: Discovering WhatsApp Business Account ID...")
    const candidates = new Set<string>()

    this.logger.info("Step 2A: Trying debug_token inspection...")
    const debugUrl = this.buildMetaUrl("/debug_token", {
      input_token: accessToken,
      access_token: `${appId}|${appSecret}`,
    })
    const debugData = await this.fetchMetaJson<MetaDebugTokenResponse>(
      debugUrl,
      "debug_token"
    )

    const granularScopes = Array.isArray(debugData.data?.granular_scopes)
      ? debugData.data?.granular_scopes
      : []

    for (const scope of granularScopes) {
      if (scope.scope !== "whatsapp_business_management") {
        continue
      }
      const targetIds = Array.isArray(scope.target_ids) ? scope.target_ids : []
      for (const targetId of targetIds) {
        if (targetId) {
          candidates.add(targetId)
        }
      }
    }

    if (candidates.size > 0) {
      this.logger.info("Step 2A Success: WABA IDs found in debug_token", {
        count: candidates.size,
      })
    }

    const appSecretProof = this.createAppSecretProof(accessToken, appSecret)
    let wabaListError: string | undefined
    this.logger.info("Step 2B: Checking /me/whatsapp_business_accounts...")
    try {
      const wabaUrl = this.buildMetaUrl("/me/whatsapp_business_accounts", {
        access_token: accessToken,
        appsecret_proof: appSecretProof,
      })
      const wabaData = await this.fetchMetaJson<MetaWabaListResponse>(
        wabaUrl,
        "waba_accounts"
      )
      const accounts = Array.isArray(wabaData.data) ? wabaData.data : []

      this.logger.info("Step 2B: Meta WABA Data received", {
        count: accounts.length,
        accounts: accounts.map((a) => ({ id: a.id, name: a.name })),
      })

      for (const account of accounts) {
        if (account.id) {
          candidates.add(account.id)
        }
      }
    } catch (error: any) {
      wabaListError = error?.message || "Unknown Meta error"
      this.logger.debug("Step 2B failed while listing WABAs", {
        message: wabaListError,
      })
    }

    if (candidates.size === 0) {
      throw new GenericException(
        wabaListError
          ? `No WhatsApp Business Account found. Last Meta error: ${wabaListError}`
          : "No WhatsApp Business Account found. Complete Meta embedded signup and make sure whatsapp_business_management permission is granted."
      )
    }

    return [...candidates]
  }

  private async resolvePhoneNumber(params: {
    accessToken: string
    wabaIds: string[]
    appSecret: string
  }): Promise<{ wabaId: string; phoneNumberId: string }> {
    this.logger.info("Step 3: Discovering phone numbers for WABA...")
    const readErrors: string[] = []
    const appSecretProof = this.createAppSecretProof(
      params.accessToken,
      params.appSecret
    )

    for (const wabaId of params.wabaIds) {
      this.logger.info(`Step 3: Checking phone numbers for WABA ${wabaId}...`)
      const phoneUrl = this.buildMetaUrl(`/${wabaId}/phone_numbers`, {
        access_token: params.accessToken,
        appsecret_proof: appSecretProof,
      })

      try {
        const phoneData = await this.fetchMetaJson<MetaPhoneListResponse>(
          phoneUrl,
          "phone_numbers"
        )
        const numbers = Array.isArray(phoneData.data) ? phoneData.data : []

        this.logger.info("Step 3: Meta Phone Data received", {
          wabaId,
          count: numbers.length,
          numbers: numbers.map((n) => ({
            id: n.id,
            display_number: n.display_phone_number,
          })),
        })

        const firstValidNumber = numbers.find((n) => Boolean(n.id))
        if (firstValidNumber?.id) {
          this.logger.info(
            `Step 3 Success: Using WABA ${wabaId} and Phone ID ${firstValidNumber.id}`
          )
          return { wabaId, phoneNumberId: firstValidNumber.id }
        }

        this.logger.warn(`No phone numbers found for WABA ${wabaId}`)
      } catch (error: any) {
        const message = error?.message || "Unknown Meta error"
        readErrors.push(message)
        this.logger.warn("Failed reading phone numbers for WABA candidate", {
          wabaId,
          message,
        })
      }
    }

    if (readErrors.length > 0) {
      throw new GenericException(
        `Unable to discover a valid WhatsApp phone number. Last Meta error: ${readErrors[readErrors.length - 1]}`
      )
    }

    throw new GenericException(
      "No phone numbers found for this WhatsApp Business Account. Add and verify a phone number in Meta Business Manager."
    )
  }

  private buildMetaUrl(path: string, params: Record<string, string>): string {
    const query = new URLSearchParams(params).toString()
    return `https://graph.facebook.com/${this.graphApiVersion}${path}?${query}`
  }

  private createAppSecretProof(accessToken: string, appSecret: string): string {
    return createHmac("sha256", appSecret).update(accessToken).digest("hex")
  }

  private async fetchMetaJson<T>(
    url: string,
    operation: string
  ): Promise<T & MetaErrorPayload> {
    let response: Response

    try {
      response = await fetch(url)
    } catch {
      throw new GenericException(
        `Meta ${operation} error: failed to reach Meta Graph API`
      )
    }

    let data: (T & MetaErrorPayload) | undefined
    try {
      data = await response.json()
    } catch {
      data = undefined
    }

    if (!response.ok || data?.error) {
      const message =
        data?.error?.message ||
        `HTTP ${response.status} ${response.statusText || "Unknown error"}`
      this.logger.error(`Meta operation failed: ${operation}`, {
        status: response.status,
        statusText: response.statusText,
        error: data?.error,
      })
      throw new GenericException(`Meta ${operation} error: ${message}`)
    }

    return (data || ({} as T & MetaErrorPayload)) as T & MetaErrorPayload
  }
}
