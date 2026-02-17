import {
  ChurchNotFound,
  type IChurchRepository,
  WhatsappCredentialsNotConfigured,
} from "@/Church/domain"
import { Logger } from "@/Shared/adapter"
import { GenericException, type ISecretManagerService } from "@/Shared/domain"
import { SecretManagerProviderService } from "@/Shared/infrastructure"
import {
  MetaWhatsappGraphService,
  type WhatsappAccessTokenSecret,
} from "@/package/whatsapp"

export class DisconnectWhatsappIntegration {
  private readonly logger = Logger(DisconnectWhatsappIntegration.name)

  constructor(
    private readonly churchRepository: IChurchRepository,
    private readonly metaWhatsapp: MetaWhatsappGraphService = new MetaWhatsappGraphService(),
    private readonly secretManager: ISecretManagerService = SecretManagerProviderService.getInstance()
  ) {}

  async execute(churchId: string): Promise<void> {
    const church = await this.churchRepository.one({ churchId })
    if (!church) {
      throw new ChurchNotFound()
    }

    const credentials = church.getWhatsappCredentials()
    if (
      !credentials.wabaId ||
      !credentials.phoneNumberId ||
      !credentials.accessTokenSecretId
    ) {
      throw new WhatsappCredentialsNotConfigured(churchId)
    }

    const accessToken = await this.resolveAccessToken(
      churchId,
      credentials.accessTokenSecretId
    )

    this.logger.info("Disconnecting WhatsApp integration from Meta", {
      churchId,
      wabaId: credentials.wabaId,
      phoneNumberId: credentials.phoneNumberId,
    })

    await this.metaWhatsapp.unsubscribeAppFromWaba(
      accessToken,
      credentials.wabaId
    )
    await this.metaWhatsapp.deregisterPhoneNumber(
      accessToken,
      credentials.phoneNumberId
    )

    await this.secretManager.deleteSecret(credentials.accessTokenSecretId)

    church.clearWhatsappCredentials()
    await this.churchRepository.upsert(church)

    this.logger.info("WhatsApp integration disconnected successfully", {
      churchId,
    })
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
        throw new GenericException(
          "WhatsApp access token not found in Secret Manager"
        )
      }
      return accessToken
    } catch (error: any) {
      this.logger.error(
        "Unable to read WhatsApp token from secret manager during disconnect",
        {
          churchId,
          secretId,
          message: error?.message ?? "Unknown error",
        }
      )
      throw new GenericException(
        "Unable to access WhatsApp token to complete disconnection"
      )
    }
  }
}
