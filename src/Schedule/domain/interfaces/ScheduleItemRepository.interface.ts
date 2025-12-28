import { ScheduleEvent } from "../ScheduleEvent"
import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"

export interface IScheduleItemRepository {
  upsert(scheduleItem: ScheduleEvent): Promise<void>

  one(filter: object): Promise<ScheduleEvent | undefined>

  list(criteria: Criteria): Promise<Paginate<ScheduleEvent>>

  findManyByChurch(churchId: string, filters?: any): Promise<ScheduleEvent[]>
}
