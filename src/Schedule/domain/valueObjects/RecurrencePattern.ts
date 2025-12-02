import { ScheduleItemException } from "../exceptions/ScheduleItemException"
import { DayOfWeek, RecurrenceType } from "../types/ScheduleItem.type"

export type RecurrencePatternPrimitives = {
  type: RecurrenceType
  dayOfWeek: DayOfWeek
  time: string
  durationMinutes: number
  timezone: string
  startDate: Date
  endDate?: Date | null
}

export class RecurrencePattern {
  private constructor(
    private readonly type: RecurrenceType,
    private readonly dayOfWeek: DayOfWeek,
    private readonly time: string,
    private readonly durationMinutes: number,
    private readonly timezone: string,
    private readonly startDate: Date,
    private readonly endDate?: Date | null
  ) {}

  static create(props: RecurrencePatternPrimitives): RecurrencePattern {
    if (props.type !== "WEEKLY") {
      throw new ScheduleItemException("Recurrence type is not supported")
    }

    RecurrencePattern.validateDayOfWeek(props.dayOfWeek)
    RecurrencePattern.validateTime(props.time)

    if (!props.durationMinutes || props.durationMinutes <= 0) {
      throw new ScheduleItemException(
        "durationMinutes must be greater than zero"
      )
    }

    if (!props.timezone || !props.timezone.trim()) {
      throw new ScheduleItemException("timezone is required")
    }

    const startDate = new Date(props.startDate)
    const endDate = props.endDate ? new Date(props.endDate) : null

    if (Number.isNaN(startDate.getTime())) {
      throw new ScheduleItemException("startDate must be a valid date")
    }

    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new ScheduleItemException("endDate must be a valid date")
    }

    if (endDate && startDate.getTime() > endDate.getTime()) {
      throw new ScheduleItemException("startDate cannot be later than endDate")
    }

    return new RecurrencePattern(
      props.type,
      props.dayOfWeek,
      props.time,
      props.durationMinutes,
      props.timezone.trim(),
      startDate,
      endDate
    )
  }

  static fromPrimitives(
    plainData: RecurrencePatternPrimitives
  ): RecurrencePattern {
    return RecurrencePattern.create({
      ...plainData,
      endDate:
        plainData.endDate === undefined
          ? undefined
          : plainData.endDate === null
            ? null
            : new Date(plainData.endDate),
    })
  }

  private static validateDayOfWeek(day: DayOfWeek): void {
    const allowed: DayOfWeek[] = [
      "SUNDAY",
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ]

    if (!allowed.includes(day)) {
      throw new ScheduleItemException("Invalid dayOfWeek for recurrence")
    }
  }

  private static validateTime(time: string): void {
    const format = /^([01]\d|2[0-3]):[0-5]\d$/

    if (!format.test(time)) {
      throw new ScheduleItemException("time must be in HH:mm format")
    }
  }

  getType(): RecurrenceType {
    return this.type
  }

  getDayOfWeek(): DayOfWeek {
    return this.dayOfWeek
  }

  getTime(): string {
    return this.time
  }

  getDurationMinutes(): number {
    return this.durationMinutes
  }

  getTimezone(): string {
    return this.timezone
  }

  getStartDate(): Date {
    return this.startDate
  }

  getEndDate(): Date | null | undefined {
    return this.endDate
  }

  toPrimitives(): RecurrencePatternPrimitives {
    return {
      type: this.type,
      dayOfWeek: this.dayOfWeek,
      time: this.time,
      durationMinutes: this.durationMinutes,
      timezone: this.timezone,
      startDate: this.startDate,
      endDate: this.endDate ?? null,
    }
  }
}
