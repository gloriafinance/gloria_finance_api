import { ScheduleItem } from "../ScheduleItem"
import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"

export interface IScheduleItemRepository {
  upsert(scheduleItem: ScheduleItem): Promise<void>

  one(filter: object): Promise<ScheduleItem | undefined>

  list(criteria: Criteria): Promise<Paginate<ScheduleItem>>

  findManyByChurch(churchId: string, filters?: any): Promise<ScheduleItem[]>
}
