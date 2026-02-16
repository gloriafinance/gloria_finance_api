import { HttpStatus } from "@/Shared/domain"
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

@Controller("/api/v1/integrations")
export class IntegrationsController {
  private logger = Logger(IntegrationsController.name)

  @Post("/whatsapp")
  //@Use([PermissionMiddleware, Can("church", "upsert")])
  @Use([PermissionMiddleware])
  async setWhatsappCredentials(
    @Body()
    body: {
      code: string
      redirectUri: string
    },
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    this.logger.info("Received request to exchange WhatsApp code", body)

    try {
      const { code, redirectUri } = body
      const appId = process.env.META_APP_ID
      const appSecret = process.env.META_APP_SECRET

      if (!appId || !appSecret) {
        throw new Error(
          "Meta App ID or Secret not configured in server environment"
        )
      }

      // 1. Exchange code for Access Token
      const exchangeUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`

      const tokenResponse = await fetch(exchangeUrl)
      const tokenData: any = await tokenResponse.json()

      if (tokenData.error) {
        this.logger.error("Meta token exchange error", tokenData.error)
        res.status(HttpStatus.BAD_REQUEST).send(tokenData.error)
        return
      }

      const accessToken = tokenData.access_token

      // 2. Get WhatsApp Business Account info
      const wabaUrl = `https://graph.facebook.com/v18.0/me/whatsapp_business_accounts?access_token=${accessToken}`
      const wabaResponse = await fetch(wabaUrl)
      const wabaData: any = await wabaResponse.json()

      if (!wabaData.data || wabaData.data.length === 0) {
        throw new Error("No WhatsApp Business Accounts found for this user")
      }

      const wabaId = wabaData.data[0].id

      // 3. Get Phone Number ID
      const phoneUrl = `https://graph.facebook.com/v18.0/${wabaId}/phone_numbers?access_token=${accessToken}`
      const phoneResponse = await fetch(phoneUrl)
      const phoneData: any = await phoneResponse.json()

      if (!phoneData.data || phoneData.data.length === 0) {
        throw new Error("No phone numbers found for this WABA")
      }

      const phoneNumberId = phoneData.data[0].id

      this.logger.info(`Discovered WABA: ${wabaId}, Phone: ${phoneNumberId}`)

      // 4. Save to Database
      await new SetWhatsappCredentials(
        ChurchMongoRepository.getInstance()
      ).execute(req.auth.churchId, wabaId, phoneNumberId, accessToken)

      res.status(HttpStatus.OK).send({
        message: "WhatsApp connected and credentials saved successfully",
        wabaId,
        phoneNumberId,
      })
    } catch (e: any) {
      this.logger.error("Internal error during WhatsApp setup", e)
      domainResponse(e, res)
    }
  }
}
