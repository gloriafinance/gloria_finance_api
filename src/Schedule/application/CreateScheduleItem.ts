import { Logger } from "@/Shared/adapter"
import { DateBR } from "@/Shared/helpers"
import { GenericException } from "@/Shared/domain"
import { IChurchRepository } from "@/Church/domain"
import {
  CreateScheduleItemRequest,
  IScheduleItemRepository,
  Location,
  RecurrencePattern,
  ScheduleItem,
} from "@/Schedule/domain"

export class CreateScheduleItem {
  private readonly logger = Logger(CreateScheduleItem.name)

  constructor(
    private readonly scheduleItemRepository: IScheduleItemRepository,
    private readonly churchRepository: IChurchRepository
  ) {}

  async execute(request: CreateScheduleItemRequest): Promise<ScheduleItem> {
    this.logger.info("Creating schedule item", request)

    const church = await this.churchRepository.one(request.churchId)
    if (!church) {
      throw new GenericException("Church not found")
    }

    const scheduleItem = ScheduleItem.create({
      churchId: church.getChurchId(),
      type: request.type,
      title: request.title,
      description: request.description,
      location: Location.create(request.location),
      recurrencePattern: RecurrencePattern.create(request.recurrencePattern),
      visibility: request.visibility,
      createdByUserId: request.currentUserId,
      createdAt: DateBR(),
    })

    await this.scheduleItemRepository.create(scheduleItem)

    return scheduleItem
  }
}
