import {
  LocationDTO,
  RecurrencePatternDTO,
  ScheduleEventType,
  ScheduleEventVisibility,
} from "@/Schedule/domain"
import { ListParams } from "@/Shared/domain"

export type CreateScheduleEventRequest = {
  churchId: string
  type: ScheduleEventType
  title: string
  description?: string
  location: LocationDTO
  recurrencePattern: RecurrencePatternDTO
  visibility: ScheduleEventVisibility
  director: string
  preacher: string
  observations?: string
  currentUserId: string
}

export type UpdateScheduleEventRequest = {
  churchId: string
  scheduleItemId: string
  title: string
  description?: string
  location?: LocationDTO
  recurrencePattern?: RecurrencePatternDTO
  visibility?: ScheduleEventVisibility
  director?: string
  preacher?: string
  observations?: string
  currentUserId: string
}

export type ListScheduleEventsFiltersRequest = {
  type?: ScheduleEventType
  visibility?: ScheduleEventVisibility
  isActive?: boolean
} & ListParams

export type WeeklyScheduleOccurrencesRequest = {
  churchId: string
  weekStartDate: string
  visibilityScope: ScheduleEventVisibility
}
