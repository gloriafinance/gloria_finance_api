import { ScheduleItem } from "../ScheduleItem"
import {
  ScheduleItemType,
  ScheduleItemVisibility,
} from "../types/ScheduleItem.type"

export type ScheduleItemFilters = {
  type?: ScheduleItemType
  visibility?: ScheduleItemVisibility
  isActive?: boolean
}

export interface IScheduleItemRepository {
  create(scheduleItem: ScheduleItem): Promise<void>

  update(scheduleItem: ScheduleItem): Promise<void>

  findById(
    churchId: string,
    scheduleItemId: string
  ): Promise<ScheduleItem | null>

  findManyByChurch(
    churchId: string,
    filters?: ScheduleItemFilters
  ): Promise<ScheduleItem[]>
}
