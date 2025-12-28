import {
  DayOfWeek,
  RecurrenceType,
  ScheduleEventType,
  ScheduleEventVisibility,
} from "@/Schedule/domain"

export type LocationDTO = {
  name: string
  address?: string
}

export type ScheduleItemConfigDTO = {
  scheduleItemId: string
  churchId: string
  type: ScheduleEventType
  title: string
  description?: string
  location: LocationDTO
  recurrencePattern: RecurrencePatternDTO
  visibility: ScheduleEventVisibility
  director: string
  preacher?: string
  observations?: string
  isActive: boolean
  createdAt: Date
  createdByUserId: string
  updatedAt?: Date
  updatedByUserId?: string
}

export type WeeklyScheduleOccurrenceDTO = {
  scheduleItemId: string
  title: string
  type: ScheduleEventType
  date: string
  startTime: string
  endTime: string
  location: LocationDTO
  visibility: ScheduleEventVisibility
}

export type RecurrencePatternDTO = {
  type: RecurrenceType
  dayOfWeek: DayOfWeek
  time: string
  durationMinutes: number
  timezone: string
  startDate: Date
  endDate?: Date | null
}
