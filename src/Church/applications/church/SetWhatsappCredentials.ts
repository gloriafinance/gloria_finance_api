import {
  Church,
  ChurchNotFound,
  type IChurchRepository,
  WhatsappCredentialAlreadyAssigned,
} from "../../domain"
import { Logger } from "@/Shared/adapter"
import { GenericException, type ISecretManagerService } from "@/Shared/domain"
import { SecretManagerProviderService } from "@/Shared/infrastructure"
import type { WhatsappAccessTokenSecret } from "@/package/whatsapp"

export class SetWhatsappCredentials {
  private logger = Logger(SetWhatsappCredentials.name)

  constructor(
    private readonly churchRepository: IChurchRepository,
    private readonly secretManager: ISecretManagerService = SecretManagerProviderService.getInstance()
  ) {}

  async execute(
    churchId: string,
    wabaId: string,
    phoneNumberId: string,
    accessToken: string
  ): Promise<void> {
    const church: Church | null = await this.churchRepository.one({
      churchId,
    })

    if (!church) {
      throw new ChurchNotFound()
    }

    const churchByWaba = await this.churchRepository.one({ wabaId })
    if (churchByWaba && churchByWaba.getChurchId() !== churchId) {
      this.logger.info(
        `WABA ${wabaId} already assigned to church ${churchByWaba.getChurchId()}`
      )
      throw new WhatsappCredentialAlreadyAssigned(
        "wabaId",
        churchByWaba.getChurchId()
      )
    }

    const churchByPhone = await this.churchRepository.one({ phoneNumberId })
    if (churchByPhone && churchByPhone.getChurchId() !== churchId) {
      this.logger.info(
        `Phone number ${phoneNumberId} already assigned to church ${churchByPhone.getChurchId()}`
      )
      throw new WhatsappCredentialAlreadyAssigned(
        "phoneNumberId",
        churchByPhone.getChurchId()
      )
    }

    const secretId = this.whatsappTokenSecretId(churchId)
    try {
      const secretPayload: WhatsappAccessTokenSecret = { accessToken }
      await this.secretManager.upsertSecret(secretId, secretPayload)
    } catch (error: any) {
      this.logger.error("Unable to store WhatsApp token in secret manager", {
        churchId,
        message: error?.message ?? "Unknown error",
      })
      throw new GenericException(
        "Unable to save WhatsApp token into secret manager"
      )
    }

    church.setWhatsappCredentials(wabaId, phoneNumberId, secretId)

    try {
      await this.churchRepository.upsert(church)
    } catch (error: any) {
      if (this.isMongoDuplicateKeyError(error)) {
        const conflictingByWaba = await this.churchRepository.one({ wabaId })
        if (
          conflictingByWaba &&
          conflictingByWaba.getChurchId() !== church.getChurchId()
        ) {
          throw new WhatsappCredentialAlreadyAssigned(
            "wabaId",
            conflictingByWaba.getChurchId()
          )
        }

        const conflictingByPhone = await this.churchRepository.one({
          phoneNumberId,
        })
        if (
          conflictingByPhone &&
          conflictingByPhone.getChurchId() !== church.getChurchId()
        ) {
          throw new WhatsappCredentialAlreadyAssigned(
            "phoneNumberId",
            conflictingByPhone.getChurchId()
          )
        }
      }
      throw error
    }

    this.logger.info(`WhatsApp credentials updated for church ${churchId}`)
  }

  private whatsappTokenSecretId(churchId: string): string {
    const prefix = (
      process.env.WHATSAPP_SECRET_PREFIX ?? "whatsapp_access_token"
    )
      .trim()
      .replace(/[^A-Za-z0-9_-]/g, "_")
    const normalizedChurchId = churchId.replace(/[^A-Za-z0-9_-]/g, "_")
    return `${prefix}_${normalizedChurchId}`.slice(0, 255)
  }

  private isMongoDuplicateKeyError(error: any): boolean {
    return error?.code === 11000
  }
}
