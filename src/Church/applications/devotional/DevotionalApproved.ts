import {
  Devotional,
  DevotionalNotFound,
  type IDevotionalRepository,
} from "@/Church/domain"
import { Logger } from "@/Shared/adapter"

export class DevotionalApproved {
  private readonly logger = Logger(DevotionalApproved.name)

  constructor(private readonly devotionalRepository: IDevotionalRepository) {}

  async execute(
    churchId: string,
    devotionalId: string,
    currentUserId: string
  ): Promise<Devotional> {
    this.logger.info("Approving devotional", {
      churchId,
      devotionalId,
      currentUserId,
    })

    const devotional = await this.devotionalRepository.findByDevotionalId(
      churchId,
      devotionalId
    )
    if (!devotional) {
      this.logger.warn("Devotional not found on approve", {
        churchId,
        devotionalId,
      })
      throw new DevotionalNotFound()
    }

    devotional.approve(currentUserId)
    await this.devotionalRepository.upsert(devotional)
    this.logger.info("Devotional approved and persisted", {
      churchId,
      devotionalId,
      status: devotional.getStatus(),
    })

    return devotional
  }
}
