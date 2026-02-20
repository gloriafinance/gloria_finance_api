import { Logger } from "@/Shared/adapter"
import {
  type IScheduleItemRepository,
  type LocationDTO,
  type RecurrencePatternDTO,
  ScheduleEventType,
  ScheduleEventVisibility,
  ScheduleItemException,
  type WeeklyScheduleOccurrenceDTO,
  type WeeklyScheduleOccurrencesRequest,
} from "@/Schedule/domain"
import dayjs, { type Dayjs } from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"

dayjs.extend(utc)
dayjs.extend(timezone)

const DEFAULT_TIMEZONE = "America/Sao_Paulo"

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

    const weekStart = dayjs.tz(
      `${request.weekStartDate}T00:00:00`,
      DEFAULT_TIMEZONE
    )

    if (!weekStart.isValid()) {
      throw new ScheduleItemException("Invalid weekStartDate")
    }

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
          request.weekStartDate
        )
      )
      .sort(
        (left, right) =>
          left.date.localeCompare(right.date) ||
          left.startTime.localeCompare(right.startTime)
      )
  }

  private expandOccurrences(
    scheduleItemId: string,
    title: string,
    type: ScheduleEventType,
    location: LocationDTO,
    recurrencePattern: RecurrencePatternDTO,
    visibility: ScheduleEventVisibility,
    weekStartDate: string
  ): WeeklyScheduleOccurrenceDTO[] {
    const recurrenceTimezone =
      recurrencePattern.timezone?.trim() || DEFAULT_TIMEZONE
    const weekStart = dayjs.tz(`${weekStartDate}T00:00:00`, recurrenceTimezone)
    const weekEnd = weekStart.add(6, "day").endOf("day")

    const targetIndex =
      this.dayOfWeekIndex[recurrencePattern.dayOfWeek] ?? undefined
    if (targetIndex === undefined) {
      return []
    }

    const startIndex = weekStart.day()
    const offset = (targetIndex - startIndex + 7) % 7
    const occurrenceDate = weekStart.add(offset, "day").startOf("day")
    const recurrenceStartDate = dayjs(recurrencePattern.startDate)
      .tz(recurrenceTimezone)
      .startOf("day")
    const recurrenceEndDate = recurrencePattern.endDate
      ? dayjs(recurrencePattern.endDate).tz(recurrenceTimezone).startOf("day")
      : null

    if (occurrenceDate.isBefore(recurrenceStartDate, "day")) {
      return []
    }

    if (recurrenceEndDate && occurrenceDate.isAfter(recurrenceEndDate, "day")) {
      return []
    }

    if (occurrenceDate.isAfter(weekEnd, "day")) {
      return []
    }

    const startTime = recurrencePattern.time
    const endTime = this.calculateEndTime(
      startTime,
      recurrencePattern.durationMinutes,
      occurrenceDate,
      recurrenceTimezone
    )

    return [
      {
        scheduleItemId,
        title,
        type,
        date: occurrenceDate.format("YYYY-MM-DD"),
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
    occurrenceDate: Dayjs,
    timezoneName: string
  ): string {
    const [hours, minutes] = startTime.split(":").map(Number)
    const startDateTime = occurrenceDate
      .tz(timezoneName)
      .hour(hours)
      .minute(minutes)
      .second(0)
      .millisecond(0)
    const endDateTime = startDateTime.add(durationMinutes, "minute")

    return endDateTime.format("HH:mm")
  }
}
