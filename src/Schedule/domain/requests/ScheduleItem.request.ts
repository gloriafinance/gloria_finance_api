import {
  LocationDTO,
  RecurrencePatternDTO,
  ScheduleItemTypeEnum,
  ScheduleItemVisibility,
} from "@/Schedule/domain"
import { ListParams } from "@/Shared/domain"

export type CreateScheduleItemRequest = {
  churchId: string
  type: ScheduleItemTypeEnum
  title: string
  description?: string
  location: LocationDTO
  recurrencePattern: RecurrencePatternDTO
  visibility: ScheduleItemVisibility
  director: string
  preacher?: string
  observations?: string
  currentUserId: string
}

export type UpdateScheduleItemRequest = {
  churchId: string
  scheduleItemId: string
  title: string
  description?: string
  location?: LocationDTO
  recurrencePattern?: RecurrencePatternDTO
  visibility?: ScheduleItemVisibility
  director?: string
  preacher?: string
  observations?: string
  currentUserId: string
}

export type ListScheduleItemsFiltersRequest = {
  type?: ScheduleItemTypeEnum
  visibility?: ScheduleItemVisibility
  isActive?: boolean
} & ListParams

export type WeeklyScheduleOccurrencesRequest = {
  churchId: string
  weekStartDate: string
  visibilityScope: ScheduleItemVisibility
}
