import { Logger } from "@/Shared/adapter"
import {
  IScheduleItemRepository,
  ScheduleEvent,
  ScheduleItemNotFoundException,
} from "@/Schedule/domain"

export class GetScheduleItem {
  private readonly logger = Logger(GetScheduleItem.name)

  constructor(
    private readonly scheduleItemRepository: IScheduleItemRepository
  ) {}

  async execute(params: {
    churchId: string
    scheduleItemId: string
  }): Promise<ScheduleEvent> {
    this.logger.info("Fetching schedule item detail", params)

    const scheduleItem = await this.scheduleItemRepository.one({
      churchId: params.churchId,
      scheduleItemId: params.scheduleItemId,
    })

    if (!scheduleItem) {
      throw new ScheduleItemNotFoundException()
    }

    return scheduleItem
  }
}
