import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"
import { DevotionalDayOfWeek } from "@/Church/domain/enums/DevotionalDayOfWeek.enum"
import type { IDevotionalDateService } from "@/Church/domain/interfaces/DevotionalDateService.interface"

dayjs.extend(utc)
dayjs.extend(timezone)

const DAY_INDEX: Record<DevotionalDayOfWeek, number> = {
  [DevotionalDayOfWeek.MONDAY]: 1,
  [DevotionalDayOfWeek.TUESDAY]: 2,
  [DevotionalDayOfWeek.WEDNESDAY]: 3,
  [DevotionalDayOfWeek.THURSDAY]: 4,
  [DevotionalDayOfWeek.FRIDAY]: 5,
  [DevotionalDayOfWeek.SATURDAY]: 6,
  [DevotionalDayOfWeek.SUNDAY]: 0,
}

export class DevotionalDateDayjsService implements IDevotionalDateService {
  private static instance: IDevotionalDateService

  static getInstance(): IDevotionalDateService {
    if (!DevotionalDateDayjsService.instance) {
      DevotionalDateDayjsService.instance = new DevotionalDateDayjsService()
    }

    return DevotionalDateDayjsService.instance
  }

  getWeekStartDateForTimezone(timezoneName: string, baseDate?: Date): string {
    const now = dayjs.tz(baseDate ?? new Date(), timezoneName)
    const day = now.day()
    const diff = day === 0 ? -6 : 1 - day
    return now.add(diff, "day").startOf("day").format("YYYY-MM-DD")
  }

  scheduleDateForDay(
    weekStartDate: string,
    dayOfWeek: DevotionalDayOfWeek,
    timezoneName: string
  ): string {
    const start = dayjs.tz(weekStartDate, timezoneName).startOf("day")
    const targetDay = DAY_INDEX[dayOfWeek]
    const currentDay = start.day()
    const diff =
      targetDay >= currentDay
        ? targetDay - currentDay
        : 7 - currentDay + targetDay
    return start.add(diff, "day").format("YYYY-MM-DD")
  }

  scheduledAtFromDateAndTime(
    scheduleDate: string,
    sendTime: string,
    timezoneName: string
  ): Date {
    const [hour, minute] = sendTime.split(":").map((value) => Number(value))
    return dayjs
      .tz(scheduleDate, timezoneName)
      .hour(hour)
      .minute(minute)
      .second(0)
      .millisecond(0)
      .toDate()
  }

  nowInTimezone(timezoneName: string): Date {
    return dayjs.tz(new Date(), timezoneName).toDate()
  }
}
