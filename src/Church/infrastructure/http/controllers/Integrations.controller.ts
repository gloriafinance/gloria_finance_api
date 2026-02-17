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
import { MetaWhatsappGraphService } from "@/package/whatsapp"

@Controller("/api/v1/integrations")
export class IntegrationsController {
  private logger = Logger(IntegrationsController.name)
  private metaWhatsapp = new MetaWhatsappGraphService()

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

      const wabaIds = await this.resolveWabaIds(accessToken)
      const { wabaId, phoneNumberId } = await this.resolvePhoneNumber({
        accessToken,
        wabaIds,
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

  private async resolveWabaIds(accessToken: string): Promise<string[]> {
    this.logger.info("Step 2: Discovering WhatsApp Business Account ID...")
    const candidates = new Set<string>()

    this.logger.info("Step 2A: Trying debug_token inspection...")
    const debugData = await this.metaWhatsapp.inspectToken(accessToken)

    const granularScopes = Array.isArray(debugData.granular_scopes)
      ? debugData.granular_scopes
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

    let wabaListError: string | undefined
    this.logger.info("Step 2B: Checking /me/whatsapp_business_accounts...")
    try {
      const accounts =
        await this.metaWhatsapp.listWhatsappBusinessAccounts(accessToken)

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
  }): Promise<{ wabaId: string; phoneNumberId: string }> {
    this.logger.info("Step 3: Discovering phone numbers for WABA...")
    const readErrors: string[] = []

    for (const wabaId of params.wabaIds) {
      this.logger.info(`Step 3: Checking phone numbers for WABA ${wabaId}...`)

      try {
        const numbers = await this.metaWhatsapp.listPhoneNumbers(
          params.accessToken,
          wabaId
        )

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

        this.logger.info(`No phone numbers found for WABA ${wabaId}`)
      } catch (error: any) {
        const message = error?.message || "Unknown Meta error"
        readErrors.push(message)
        this.logger.debug("Failed reading phone numbers for WABA candidate", {
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
}
