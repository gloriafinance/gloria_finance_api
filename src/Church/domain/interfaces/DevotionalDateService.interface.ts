import type { DevotionalDayOfWeek } from "@/Church/domain/enums/DevotionalDayOfWeek.enum"

export interface IDevotionalDateService {
  getWeekStartDateForTimezone(timezoneName: string, baseDate?: Date): string

  getNextWeekStartDateForTimezone(timezoneName: string, baseDate?: Date): string

  scheduleDateForDay(
    weekStartDate: string,
    dayOfWeek: DevotionalDayOfWeek,
    timezoneName: string
  ): string

  scheduledAtFromDateAndTime(
    scheduleDate: string,
    sendTime: string,
    timezoneName: string
  ): Date

  nowInTimezone(timezoneName: string): Date
}
