import type { ScheduleEvent } from "@/Schedule/domain"

export interface IScheduleReminderService {
  shouldQueueReminder(
    scheduleItem: ScheduleEvent,
    churchTimezone: string,
    referenceDate: Date,
    notificationTime: string
  ): boolean

  reminderDelayMs(
    churchTimezone: string,
    referenceDate: Date,
    notificationTime: string
  ): number

  formatScheduledDateTime(
    scheduleItem: ScheduleEvent,
    churchTimezone: string,
    referenceDate: Date
  ): string

  notificationDateKey(
    scheduleItem: ScheduleEvent,
    churchTimezone: string,
    referenceDate?: Date
  ): string

  isExpired(
    scheduleItem: ScheduleEvent,
    churchTimezone: string,
    referenceDate: Date
  ): boolean
}
