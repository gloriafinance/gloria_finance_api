import { Logger } from "@/Shared/adapter"
import {
  IScheduleItemRepository,
  Location,
  RecurrencePattern,
  ScheduleItemNotFoundException,
  UpdateScheduleItemRequest,
} from "@/Schedule/domain"

export class UpdateScheduleItem {
  private readonly logger = Logger(UpdateScheduleItem.name)

  constructor(
    private readonly scheduleItemRepository: IScheduleItemRepository
  ) {}

  async execute(request: UpdateScheduleItemRequest): Promise<void> {
    this.logger.info("Updating schedule item", request)

    const scheduleItem = await this.scheduleItemRepository.findById(
      request.churchId,
      request.scheduleItemId
    )

    if (!scheduleItem) {
      throw new ScheduleItemNotFoundException()
    }

    if (
      request.title !== undefined ||
      request.description !== undefined ||
      request.location !== undefined ||
      request.visibility !== undefined
    ) {
      scheduleItem.updateDetails({
        title: request.title ?? scheduleItem.getTitle(),
        description: request.description ?? scheduleItem.getDescription(),
        location: request.location
          ? Location.create(request.location)
          : scheduleItem.getLocation(),
        visibility: request.visibility ?? scheduleItem.getVisibility(),
        updatedByUserId: request.currentUserId,
      })
    }

    if (request.recurrencePattern) {
      scheduleItem.updateRecurrence(
        RecurrencePattern.create(request.recurrencePattern),
        request.currentUserId
      )
    }

    await this.scheduleItemRepository.update(scheduleItem)
  }
}
