import { ScheduleEvent } from "../ScheduleEvent"
import { type IRepository } from "@abejarano/ts-mongodb-criteria"

export interface IScheduleItemRepository extends IRepository<ScheduleEvent> {
  findManyByChurch(churchId: string, filters?: any): Promise<ScheduleEvent[]>

  findTodayByChurch(churchId: string): Promise<ScheduleEvent | undefined>

  deactivatePreviousDayEvents(): Promise<number>
}
