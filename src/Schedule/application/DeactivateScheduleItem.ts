import { Logger } from "@/Shared/adapter"
import {
  IScheduleItemRepository,
  ScheduleItemNotFoundException,
} from "@/Schedule/domain"

export class DeactivateScheduleItem {
  private readonly logger = Logger(DeactivateScheduleItem.name)

  constructor(
    private readonly scheduleItemRepository: IScheduleItemRepository
  ) {}

  async execute(params: {
    churchId: string
    scheduleItemId: string
    currentUserId: string
  }): Promise<void> {
    this.logger.info("Deactivating schedule item", params)

    const scheduleItem = await this.scheduleItemRepository.one({
      churchId: params.churchId,
      scheduleItemId: params.scheduleItemId,
    })

    if (!scheduleItem) {
      throw new ScheduleItemNotFoundException()
    }

    scheduleItem.deactivate(params.currentUserId)

    await this.scheduleItemRepository.upsert(scheduleItem)
  }
}
