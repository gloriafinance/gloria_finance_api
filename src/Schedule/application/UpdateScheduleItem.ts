import { Logger } from "@/Shared/adapter"
import {
  IScheduleItemRepository,
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

    const scheduleItem = await this.scheduleItemRepository.one({
      churchId: request.churchId,
      scheduleItemId: request.scheduleItemId,
    })

    if (!scheduleItem) {
      throw new ScheduleItemNotFoundException()
    }

    if (
      request.title !== undefined ||
      request.description !== undefined ||
      request.location !== undefined ||
      request.visibility !== undefined ||
      request.director !== undefined ||
      request.preacher !== undefined ||
      request.observations !== undefined
    ) {
      scheduleItem.updateDetails({
        title: request.title ?? scheduleItem.getTitle(),
        description: request.description ?? scheduleItem.getDescription(),
        location: request.location
          ? request.location
          : scheduleItem.getLocation(),
        visibility: request.visibility ?? scheduleItem.getVisibility(),
        director: request.director ?? scheduleItem.getDirector(),
        preacher:
          request.preacher !== undefined
            ? request.preacher
            : scheduleItem.getPreacher(),
        observations:
          request.observations !== undefined
            ? request.observations
            : scheduleItem.getObservations(),
        updatedByUserId: request.currentUserId,
      })
    }

    if (request.recurrencePattern) {
      scheduleItem.updateRecurrence(
        request.recurrencePattern,
        request.currentUserId
      )
    }

    await this.scheduleItemRepository.upsert(scheduleItem)
  }
}
