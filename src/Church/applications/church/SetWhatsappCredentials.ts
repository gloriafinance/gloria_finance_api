import {
  Church,
  ChurchNotFound,
  type IChurchRepository,
  WhatsappCredentialAlreadyAssigned,
} from "../../domain"
import { Logger } from "@/Shared/adapter"

export class SetWhatsappCredentials {
  private logger = Logger(SetWhatsappCredentials.name)

  constructor(private readonly churchRepository: IChurchRepository) {}

  async execute(
    churchId: string,
    wabaId: string,
    phoneNumberId: string,
    accessToken: string
  ): Promise<void> {
    const church: Church | undefined =
      await this.churchRepository.findById(churchId)

    if (!church) {
      throw new ChurchNotFound()
    }

    const churchByWaba = await this.churchRepository.one({ wabaId })
    if (churchByWaba && churchByWaba.getChurchId() !== churchId) {
      this.logger.warn(
        `WABA ${wabaId} already assigned to church ${churchByWaba.getChurchId()}`
      )
      throw new WhatsappCredentialAlreadyAssigned(
        "wabaId",
        churchByWaba.getChurchId()
      )
    }

    const churchByPhone = await this.churchRepository.one({ phoneNumberId })
    if (churchByPhone && churchByPhone.getChurchId() !== churchId) {
      this.logger.warn(
        `Phone number ${phoneNumberId} already assigned to church ${churchByPhone.getChurchId()}`
      )
      throw new WhatsappCredentialAlreadyAssigned(
        "phoneNumberId",
        churchByPhone.getChurchId()
      )
    }

    church.setWhatsappCredentials(wabaId, phoneNumberId, accessToken)

    await this.churchRepository.upsert(church)

    this.logger.info(`WhatsApp credentials updated for church ${churchId}`)
  }
}
