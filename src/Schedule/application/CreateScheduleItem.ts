import { Logger } from "@/Shared/adapter"
import { DateBR } from "@/Shared/helpers"
import { ChurchNotFound, IChurchRepository } from "@/Church/domain"
import {
  CreateScheduleEventRequest,
  IScheduleItemRepository,
  ScheduleEvent,
} from "@/Schedule/domain"

export class CreateScheduleItem {
  private readonly logger = Logger(CreateScheduleItem.name)

  constructor(
    private readonly scheduleItemRepository: IScheduleItemRepository,
    private readonly churchRepository: IChurchRepository
  ) {}

  async execute(request: CreateScheduleEventRequest): Promise<ScheduleEvent> {
    this.logger.info("Creating schedule item", request)

    const church = await this.churchRepository.one(request.churchId)
    if (!church) {
      throw new ChurchNotFound()
    }

    const scheduleItem = ScheduleEvent.create({
      churchId: church.getChurchId(),
      type: request.type,
      title: request.title,
      description: request.description,
      location: request.location,
      recurrencePattern: request.recurrencePattern,
      visibility: request.visibility,
      director: request.director,
      preacher: request.preacher,
      observations: request.observations,
      createdByUserId: request.currentUserId,
      createdAt: DateBR(),
    })

    await this.scheduleItemRepository.upsert(scheduleItem)

    return scheduleItem
  }
}
