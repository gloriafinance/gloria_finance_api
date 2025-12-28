import { Logger } from "@/Shared/adapter"
import {
  IScheduleItemRepository,
  LocationDTO,
  RecurrencePatternDTO,
  ScheduleEventType,
  ScheduleEventVisibility,
  ScheduleItemException,
  WeeklyScheduleOccurrenceDTO,
  WeeklyScheduleOccurrencesRequest,
} from "@/Schedule/domain"

type DayOfWeekIndex = {
  [key: string]: number
}

export class ListWeeklyScheduleOccurrences {
  private readonly logger = Logger(ListWeeklyScheduleOccurrences.name)

  private readonly dayOfWeekIndex: DayOfWeekIndex = {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
  }

  constructor(
    private readonly scheduleItemRepository: IScheduleItemRepository
  ) {}

  async execute(
    request: WeeklyScheduleOccurrencesRequest
  ): Promise<WeeklyScheduleOccurrenceDTO[]> {
    this.logger.info("Listing weekly schedule occurrences", request)

    const weekStart = new Date(`${request.weekStartDate}T00:00:00`)

    if (Number.isNaN(weekStart.getTime())) {
      throw new ScheduleItemException("Invalid weekStartDate")
    }

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const scheduleItems = await this.scheduleItemRepository.findManyByChurch(
      request.churchId,
      {
        isActive: true,
      }
    )

    return scheduleItems
      .filter((item) =>
        request.visibilityScope === ScheduleEventVisibility.PUBLIC
          ? item.getVisibility() === ScheduleEventVisibility.PUBLIC
          : true
      )
      .flatMap((item) =>
        this.expandOccurrences(
          item.getScheduleItemId(),
          item.getTitle(),
          item.getType(),
          item.getLocation(),
          item.getRecurrencePattern(),
          item.getVisibility(),
          weekStart,
          weekEnd
        )
      )
  }

  private expandOccurrences(
    scheduleItemId: string,
    title: string,
    type: ScheduleEventType,
    location: LocationDTO,
    recurrencePattern: RecurrencePatternDTO,
    visibility: ScheduleEventVisibility,
    weekStart: Date,
    weekEnd: Date
  ): WeeklyScheduleOccurrenceDTO[] {
    const targetIndex =
      this.dayOfWeekIndex[recurrencePattern.dayOfWeek] ?? undefined
    if (targetIndex === undefined) {
      return []
    }

    const startIndex = weekStart.getDay()
    const offset = (targetIndex - startIndex + 7) % 7
    const occurrenceDate = new Date(weekStart)
    occurrenceDate.setDate(weekStart.getDate() + offset)

    if (occurrenceDate < recurrencePattern.startDate) {
      return []
    }

    const recurrenceEndDate = recurrencePattern.endDate
    if (recurrenceEndDate && occurrenceDate > recurrenceEndDate) {
      return []
    }

    if (occurrenceDate > weekEnd) {
      return []
    }

    const startTime = recurrencePattern.time
    const endTime = this.calculateEndTime(
      startTime,
      recurrencePattern.durationMinutes,
      occurrenceDate
    )

    return [
      {
        scheduleItemId,
        title,
        type,
        date: occurrenceDate.toISOString().split("T")[0],
        startTime,
        endTime,
        location,
        visibility,
      },
    ]
  }

  private calculateEndTime(
    startTime: string,
    durationMinutes: number,
    occurrenceDate: Date
  ): string {
    const [hours, minutes] = startTime.split(":").map(Number)
    const startDateTime = new Date(occurrenceDate)
    startDateTime.setHours(hours)
    startDateTime.setMinutes(minutes)
    startDateTime.setSeconds(0)
    startDateTime.setMilliseconds(0)

    const endDateTime = new Date(
      startDateTime.getTime() + durationMinutes * 60000
    )

    const endHours = `${endDateTime.getHours()}`.padStart(2, "0")
    const endMinutes = `${endDateTime.getMinutes()}`.padStart(2, "0")

    return `${endHours}:${endMinutes}`
  }
}
