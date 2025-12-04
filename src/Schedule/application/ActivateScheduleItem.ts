import { Logger } from "@/Shared/adapter"
import {
  IScheduleItemRepository,
  ScheduleItemNotFoundException,
} from "@/Schedule/domain"

export class ActivateScheduleItem {
  private readonly logger = Logger(ActivateScheduleItem.name)

  constructor(
    private readonly scheduleItemRepository: IScheduleItemRepository
  ) {}

  async execute(params: {
    churchId: string
    scheduleItemId: string
    currentUserId: string
  }): Promise<void> {
    this.logger.info("Activating schedule item", params)

    const scheduleItem = await this.scheduleItemRepository.one({
      churchId: params.churchId,
      scheduleItemId: params.scheduleItemId,
    })

    if (!scheduleItem) {
      throw new ScheduleItemNotFoundException()
    }

    scheduleItem.activate(params.currentUserId)

    await this.scheduleItemRepository.upsert(scheduleItem)
  }
}
