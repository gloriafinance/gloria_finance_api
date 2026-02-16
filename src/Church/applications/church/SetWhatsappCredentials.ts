import { Church, ChurchNotFound, type IChurchRepository } from "../../domain"
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

    church.setWhatsappCredentials(wabaId, phoneNumberId, accessToken)

    await this.churchRepository.upsert(church)

    this.logger.info(`WhatsApp credentials updated for church ${churchId}`)
  }
}
