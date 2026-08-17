import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  DayOfWeek,
  type IScheduleItemRepository,
  ScheduleEvent,
  ScheduleEventStatus,
} from "@/Schedule/domain"
import { Collection } from "mongodb"
import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"

dayjs.extend(utc)
dayjs.extend(timezone)

const SCHEDULE_TIMEZONE = "America/Sao_Paulo"
const dayOfWeekByIndex: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUNDAY,
  1: DayOfWeek.MONDAY,
  2: DayOfWeek.TUESDAY,
  3: DayOfWeek.WEDNESDAY,
  4: DayOfWeek.THURSDAY,
  5: DayOfWeek.FRIDAY,
  6: DayOfWeek.SATURDAY,
}

export class ScheduleItemMongoRepository
  extends MongoRepository<ScheduleEvent>
  implements IScheduleItemRepository
{
  private static instance: ScheduleItemMongoRepository

  private constructor() {
    super(ScheduleEvent)
  }

  static getInstance(): ScheduleItemMongoRepository {
    if (!ScheduleItemMongoRepository.instance) {
      ScheduleItemMongoRepository.instance = new ScheduleItemMongoRepository()
    }
    return ScheduleItemMongoRepository.instance
  }

  collectionName(): string {
    return "schedule_events"
  }

  async findManyByChurch(
    churchId: string,
    filters?: any
  ): Promise<ScheduleEvent[]> {
    const collection = await this.collection()
    const query: Record<string, unknown> = {
      churchId,
    }

    if (filters?.type) {
      query.type = filters.type
    }

    if (filters?.visibility) {
      query.visibility = filters.visibility
    }

    if (filters?.status) {
      query.status = filters.status
    }

    const result = await collection.find(query).toArray()

    return result.map((document) =>
      ScheduleEvent.fromPrimitives({
        id: document._id,
        ...document,
      })
    )
  }

  async deactivatePreviousDayEvents(): Promise<number> {
    const now = dayjs().tz(SCHEDULE_TIMEZONE)
    const startOfYesterday = now.subtract(1, "day").startOf("day").toDate()
    const endOfYesterday = now.subtract(1, "day").endOf("day").toDate()

    const collection = await this.collection()
    const filter = {
      status: ScheduleEventStatus.ACTIVE,
      "recurrencePattern.endDate": {
        $gte: startOfYesterday,
        $lte: endOfYesterday,
      },
    }
    const update = {
      $set: {
        status: ScheduleEventStatus.FINALIZED,
        updatedAt: now.toDate(),
      },
    }

    const result = await collection.updateMany(filter, update)

    return result.modifiedCount
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex(
      { churchId: 1, scheduleItemId: 1 },
      { background: true, name: "idx_schedule_church_item" }
    )
    await collection.createIndex(
      {
        churchId: 1,
        status: 1,
        "recurrencePattern.dayOfWeek": 1,
        "recurrencePattern.startDate": 1,
        "recurrencePattern.endDate": 1,
        "recurrencePattern.time": 1,
      },
      { background: true, name: "idx_schedule_today_lookup" }
    )
    await collection.createIndex(
      {
        churchId: 1,
        type: 1,
        visibility: 1,
        status: 1,
      },
      { background: true, name: "idx_schedule_filters" }
    )
    await collection.createIndex(
      {
        status: 1,
        "recurrencePattern.endDate": 1,
      },
      { background: true, name: "idx_schedule_deactivate_previous_day_global" }
    )
  }
}
