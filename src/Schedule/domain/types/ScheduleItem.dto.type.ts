import { LocationPrimitives } from "../valueObjects/Location"
import { RecurrencePatternPrimitives } from "../valueObjects/RecurrencePattern"
import { ScheduleItemType, ScheduleItemVisibility } from "./ScheduleItem.type"

export type ScheduleItemConfigDTO = {
  scheduleItemId: string
  churchId: string
  type: ScheduleItemType
  title: string
  description?: string
  location: LocationPrimitives
  recurrencePattern: RecurrencePatternPrimitives
  visibility: ScheduleItemVisibility
  isActive: boolean
  createdAt: Date
  createdByUserId: string
  updatedAt?: Date
  updatedByUserId?: string
}

export type WeeklyScheduleOccurrenceDTO = {
  scheduleItemId: string
  title: string
  type: ScheduleItemType
  date: string
  startTime: string
  endTime: string
  location: LocationPrimitives
  visibility: ScheduleItemVisibility
}
