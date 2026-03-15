import type { ScheduleEvent } from "@/Schedule/domain"

export interface IScheduleReminderService {
  shouldQueueReminder(
    scheduleItem: ScheduleEvent,
    churchTimezone: string,
    referenceDate?: Date
  ): boolean

  reminderDelayMs(
    scheduleItem: ScheduleEvent,
    churchTimezone: string,
    referenceDate?: Date
  ): number

  formatScheduledDateTime(
    scheduleItem: ScheduleEvent,
    churchTimezone: string,
    referenceDate?: Date
  ): string

  notificationDateKey(
    scheduleItem: ScheduleEvent,
    churchTimezone: string,
    referenceDate?: Date
  ): string

  isExpired(
    scheduleItem: ScheduleEvent,
    churchTimezone: string,
    referenceDate?: Date
  ): boolean
}
