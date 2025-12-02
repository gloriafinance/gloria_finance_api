import { LocationPrimitives } from "../valueObjects/Location"
import { RecurrencePatternPrimitives } from "../valueObjects/RecurrencePattern"
import {
  ScheduleItemType,
  ScheduleItemVisibility,
} from "../types/ScheduleItem.type"

export type CreateScheduleItemRequest = {
  churchId: string
  type: ScheduleItemType
  title: string
  description?: string
  location: LocationPrimitives
  recurrencePattern: RecurrencePatternPrimitives
  visibility: ScheduleItemVisibility
  currentUserId: string
}

export type UpdateScheduleItemRequest = {
  churchId: string
  scheduleItemId: string
  title?: string
  description?: string
  location?: LocationPrimitives
  recurrencePattern?: RecurrencePatternPrimitives
  visibility?: ScheduleItemVisibility
  currentUserId: string
}

export type ListScheduleItemsFiltersRequest = {
  churchId: string
  filters?: {
    type?: ScheduleItemType
    visibility?: ScheduleItemVisibility
    isActive?: boolean
  }
}

export type WeeklyScheduleOccurrencesRequest = {
  churchId: string
  weekStartDate: string
  visibilityScope: ScheduleItemVisibility
}
