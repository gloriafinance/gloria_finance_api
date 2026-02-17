import { Logger } from "@/Shared/adapter"
import { GenericException } from "@/Shared/domain"
import { MetaWhatsappGraphService } from "./MetaWhatsappGraph.service"

export class WhatsappConnectionResolverService {
  private readonly logger = Logger(WhatsappConnectionResolverService.name)

  constructor(
    private readonly metaWhatsapp: MetaWhatsappGraphService = new MetaWhatsappGraphService()
  ) {}

  async resolve(accessToken: string): Promise<{
    wabaId: string
    phoneNumberId: string
  }> {
    const wabaIds = await this.resolveWabaIds(accessToken)
    return this.resolvePhoneNumber({ accessToken, wabaIds })
  }

  async resolveWabaIds(accessToken: string): Promise<string[]> {
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
    } catch (error: unknown) {
      wabaListError = this.metaErrorMessage(error)
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

  async resolvePhoneNumber(params: {
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
      } catch (error: unknown) {
        const message = this.metaErrorMessage(error)
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

  private metaErrorMessage(error: unknown): string {
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message
      if (typeof message === "string" && message.trim()) {
        return message
      }
    }
    return "Unknown Meta error"
  }
}
