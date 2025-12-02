import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  IScheduleItemRepository,
  ScheduleItem,
  ScheduleItemFilters,
} from "@/Schedule/domain"

export class ScheduleItemMongoRepository
  extends MongoRepository<ScheduleItem>
  implements IScheduleItemRepository
{
  private static instance: ScheduleItemMongoRepository
  private indexesInitialized = false

  static getInstance(): ScheduleItemMongoRepository {
    if (!ScheduleItemMongoRepository.instance) {
      ScheduleItemMongoRepository.instance = new ScheduleItemMongoRepository()
    }
    return ScheduleItemMongoRepository.instance
  }

  collectionName(): string {
    return "schedule_evetns"
  }

  async create(scheduleItem: ScheduleItem): Promise<void> {
    await this.ensureIndexes()
    const collection = await this.collection()

    await collection.updateOne(
      {
        churchId: scheduleItem.getChurchId(),
        scheduleItemId: scheduleItem.getScheduleItemId(),
      },
      {
        $set: scheduleItem.toPrimitives() as any,
      },
      { upsert: true }
    )
  }

  async update(scheduleItem: ScheduleItem): Promise<void> {
    await this.ensureIndexes()
    const collection = await this.collection()

    await collection.updateOne(
      {
        churchId: scheduleItem.getChurchId(),
        scheduleItemId: scheduleItem.getScheduleItemId(),
      },
      {
        $set: scheduleItem.toPrimitives() as any,
      }
    )
  }

  async findById(
    churchId: string,
    scheduleItemId: string
  ): Promise<ScheduleItem | null> {
    const collection = await this.collection()
    const result = await collection.findOne({ churchId, scheduleItemId })

    if (!result) {
      return null
    }

    return ScheduleItem.fromPrimitives({
      id: result._id,
      ...result,
    })
  }

  async findManyByChurch(
    churchId: string,
    filters?: ScheduleItemFilters
  ): Promise<ScheduleItem[]> {
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

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive
    }

    const result = await collection.find(query).toArray()

    return result.map((document) =>
      ScheduleItem.fromPrimitives({
        id: document._id,
        ...document,
      })
    )
  }

  private async ensureIndexes(): Promise<void> {
    if (this.indexesInitialized) {
      return
    }

    const collection = await this.collection()
    await collection.createIndex({ churchId: 1, isActive: 1 })
    await collection.createIndex({ churchId: 1, type: 1 })

    this.indexesInitialized = true
  }
}
