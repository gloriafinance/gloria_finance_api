import { HttpStatus } from "@/Shared/domain"
import { GenericException } from "@/Shared/domain/exceptions/generic-exception"
import domainResponse from "@/Shared/helpers/domainResponse"
import {
  DisconnectWhatsappIntegration,
  SetWhatsappCredentials,
} from "@/Church/applications"
import { ChurchMongoRepository } from "@/Church/infrastructure"
import {
  Body,
  Controller,
  Delete,
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
import {
  MetaWhatsappGraphService,
  WhatsappConnectionResolverService,
} from "@/package/whatsapp"

@Controller("/api/v1/integrations")
export class IntegrationsController {
  private logger = Logger(IntegrationsController.name)
  private metaWhatsapp = new MetaWhatsappGraphService()
  private whatsappConnectionResolver = new WhatsappConnectionResolverService(
    this.metaWhatsapp
  )

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

      const accessToken = await this.exchangeCodeForAccessToken({
        code,
        redirectUri,
      })
      this.logger.info("Step 1 Success: Token obtained")

      const { wabaId, phoneNumberId } =
        await this.whatsappConnectionResolver.resolve(accessToken)

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

  @Delete("/whatsapp")
  @Use([PermissionMiddleware])
  async disconnectWhatsappIntegration(
    @Req() req: AuthenticatedRequest,
    @Res() res: ServerResponse
  ) {
    try {
      await new DisconnectWhatsappIntegration(
        ChurchMongoRepository.getInstance()
      ).execute(req.auth.churchId)

      res.status(HttpStatus.OK).send({
        message: "WhatsApp disconnected successfully",
      })
    } catch (e: any) {
      this.logger.error("WhatsApp disconnect flow failed", e)
      domainResponse(e, res)
    }
  }

  private async exchangeCodeForAccessToken(params: {
    code: string
    redirectUri: string
  }): Promise<string> {
    this.logger.info("Step 1: Exchanging code for Access Token...")
    const data = await this.metaWhatsapp.exchangeCodeForAccessToken({
      code: params.code,
      redirectUri: params.redirectUri,
    })
    return data.accessToken
  }
}
