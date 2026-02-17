import {
  ChurchNotFound,
  type IChurchRepository,
  type SendWhatsappTextMessageRequest,
  WhatsappCredentialsNotConfigured,
} from "@/Church/domain"
import { Logger } from "@/Shared/adapter"
import { GenericException, type ISecretManagerService } from "@/Shared/domain"
import { SecretManagerProviderService } from "@/Shared/infrastructure"
import {
  MetaWhatsappGraphService,
  type WhatsappAccessTokenSecret,
} from "@/package/whatsapp"

type SendWhatsappTextMessageResponse = {
  messageId?: string
}

export class SendWhatsappTextMessage {
  private readonly logger = Logger(SendWhatsappTextMessage.name)

  constructor(
    private readonly churchRepository: IChurchRepository,
    private readonly metaWhatsapp: MetaWhatsappGraphService = new MetaWhatsappGraphService(),
    private readonly secretManager: ISecretManagerService = SecretManagerProviderService.getInstance()
  ) {}

  async execute(
    request: SendWhatsappTextMessageRequest
  ): Promise<SendWhatsappTextMessageResponse> {
    const to = this.normalizeRecipient(request.to)
    const body = this.normalizeBody(request.body)

    const church = await this.churchRepository.one({
      churchId: request.churchId,
    })
    if (!church) {
      throw new ChurchNotFound()
    }

    const credentials = church.getWhatsappCredentials()
    if (
      !credentials.wabaId ||
      !credentials.phoneNumberId ||
      !credentials.accessTokenSecretId
    ) {
      throw new WhatsappCredentialsNotConfigured(church.getChurchId())
    }
    const accessToken = await this.resolveAccessToken(
      church.getChurchId(),
      credentials.accessTokenSecretId
    )

    this.logger.info("Sending WhatsApp text message", {
      churchId: church.getChurchId(),
      to,
    })

    const response = await this.metaWhatsapp.sendTextMessage({
      accessToken,
      phoneNumberId: credentials.phoneNumberId,
      to,
      body,
      previewUrl: request.previewUrl,
    })

    this.logger.info("WhatsApp text message sent", {
      churchId: church.getChurchId(),
      messageId: response.messageId,
    })

    return response
  }

  private normalizeRecipient(to: string): string {
    const normalized = String(to ?? "").replace(/[^\d]/g, "")
    if (!normalized) {
      throw new GenericException("Field `to` is required")
    }
    return normalized
  }

  private normalizeBody(body: string): string {
    const normalized = String(body ?? "").trim()
    if (!normalized) {
      throw new GenericException("Field `body` is required")
    }
    if (normalized.length > 4096) {
      throw new GenericException(
        "Field `body` exceeds max length supported by WhatsApp (4096)"
      )
    }
    return normalized
  }

  private async resolveAccessToken(
    churchId: string,
    secretId: string
  ): Promise<string> {
    try {
      const secret =
        await this.secretManager.accessSecret<WhatsappAccessTokenSecret>(
          secretId
        )
      const accessToken = secret?.accessToken?.trim()
      if (!accessToken) {
        throw new WhatsappCredentialsNotConfigured(churchId)
      }
      return accessToken
    } catch (error: any) {
      this.logger.error("Unable to read WhatsApp token from secret manager", {
        churchId,
        secretId,
        message: error?.message ?? "Unknown error",
      })
      throw new WhatsappCredentialsNotConfigured(churchId)
    }
  }
}
