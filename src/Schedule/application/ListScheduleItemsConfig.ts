import { Logger } from "@/Shared/adapter"
import {
  IScheduleItemRepository,
  ListScheduleItemsFiltersRequest,
  ScheduleItemConfigDTO,
} from "@/Schedule/domain"

export class ListScheduleItemsConfig {
  private readonly logger = Logger(ListScheduleItemsConfig.name)

  constructor(
    private readonly scheduleItemRepository: IScheduleItemRepository
  ) {}

  async execute(
    request: ListScheduleItemsFiltersRequest
  ): Promise<ScheduleItemConfigDTO[]> {
    this.logger.info("Listing schedule item configurations", request)

    const scheduleItems = await this.scheduleItemRepository.findManyByChurch(
      request.churchId,
      request.filters
    )

    return scheduleItems.map((item) => ({
      scheduleItemId: item.getScheduleItemId(),
      churchId: item.getChurchId(),
      type: item.getType(),
      title: item.getTitle(),
      description: item.getDescription(),
      location: item.getLocation().toPrimitives(),
      recurrencePattern: item.getRecurrencePattern().toPrimitives(),
      visibility: item.getVisibility(),
      isActive: item.getIsActive(),
      createdAt: item.getCreatedAt(),
      createdByUserId: item.getCreatedByUserId(),
      updatedAt: item.getUpdatedAt(),
      updatedByUserId: item.getUpdatedByUserId(),
    }))
  }
}
