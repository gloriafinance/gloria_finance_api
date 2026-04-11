import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"
import {
  DayOfWeek,
  type IScheduleReminderService,
  type ScheduleEvent,
} from "@/Schedule/domain"

dayjs.extend(utc)
dayjs.extend(timezone)

const DEFAULT_TIMEZONE = "America/Sao_Paulo"
const REMINDER_TIME = "09:00"

const dayOfWeekByIndex: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
}

export class ScheduleReminderDayjsService implements IScheduleReminderService {
  private static instance: IScheduleReminderService

  static getInstance(): IScheduleReminderService {
    if (!ScheduleReminderDayjsService.instance) {
      ScheduleReminderDayjsService.instance = new ScheduleReminderDayjsService()
    }

    return ScheduleReminderDayjsService.instance
  }

  shouldQueueReminder(
    scheduleItem: ScheduleEvent,
    churchTimezone: string,
    referenceDate: Date,
    notificationTime: string
  ): boolean {
    const recurrencePattern = scheduleItem.getRecurrencePattern()

    const localNow = dayjs(referenceDate).tz(churchTimezone)

    if (recurrencePattern.dayOfWeek !== dayOfWeekByIndex[localNow.day()]) {
      return false
    }

    const [hours, minutes] = notificationTime.split(":").map(Number)
    const reminderAt = localNow
      .startOf("day")
      .hour(hours!)
      .minute(minutes!)
      .second(0)
      .millisecond(0)

    if (!reminderAt.isAfter(localNow)) {
      return false
    }

    const startOfDay = localNow.startOf("day")
    const recurrenceStartDate = dayjs(recurrencePattern.startDate)
      .tz(churchTimezone)
      .startOf("day")
    const recurrenceEndDate = recurrencePattern.endDate
      ? dayjs(recurrencePattern.endDate).tz(churchTimezone).startOf("day")
      : null

    if (startOfDay.isBefore(recurrenceStartDate, "day")) {
      return false
    }

    if (recurrenceEndDate && startOfDay.isAfter(recurrenceEndDate, "day")) {
      return false
    }

    return true
  }

  reminderDelayMs(
    churchTimezone: string,
    referenceDate: Date,
    notificationTime: string
  ): number {
    const [hours, minutes] = notificationTime.split(":").map(Number)

    const localNow = dayjs(referenceDate).tz(churchTimezone)
    const reminderAt = localNow
      .startOf("day")
      .hour(hours!)
      .minute(minutes!)
      .second(0)
      .millisecond(0)

    return Math.max(0, reminderAt.diff(localNow, "millisecond"))
  }

  formatScheduledDateTime(
    scheduleItem: ScheduleEvent,
    churchTimezone: string,
    referenceDate: Date
  ): string {
    const recurrencePattern = scheduleItem.getRecurrencePattern()

    const startOfDay = dayjs(referenceDate ?? new Date())
      .tz(churchTimezone)
      .startOf("day")
    const [hours, minutes] = recurrencePattern.time.split(":").map(Number)
    const scheduledAt = startOfDay
      .hour(hours!)
      .minute(minutes!)
      .second(0)
      .millisecond(0)

    return scheduledAt.format("M/D/YYYY, h:mm A")
  }

  notificationDateKey(
    scheduleItem: ScheduleEvent,
    churchTimezone: string,
    referenceDate: Date
  ): string {
    const recurrencePattern = scheduleItem.getRecurrencePattern()

    return dayjs(referenceDate ?? new Date())
      .tz(churchTimezone)
      .startOf("day")
      .format("YYYY-MM-DD")
  }

  isExpired(
    scheduleItem: ScheduleEvent,
    churchTimezone: string,
    referenceDate?: Date
  ): boolean {
    const recurrencePattern = scheduleItem.getRecurrencePattern()
    if (!recurrencePattern.endDate) {
      return false
    }

    const localNow = dayjs(referenceDate ?? new Date()).tz(churchTimezone)
    const recurrenceEndDate = dayjs(recurrencePattern.endDate)
      .tz(churchTimezone)
      .startOf("day")

    return recurrenceEndDate.isBefore(localNow.startOf("day"), "day")
  }
}
