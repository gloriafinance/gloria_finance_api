import {
  Criteria,
  MongoRepository,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"
import { IScheduleItemRepository, ScheduleItem } from "@/Schedule/domain"

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
    return "schedule_events"
  }

  async upsert(scheduleItem: ScheduleItem): Promise<void> {
    await this.persist(scheduleItem.getId(), scheduleItem)
  }

  // async create(scheduleItem: ScheduleItem): Promise<void> {
  //   await this.ensureIndexes()
  //   const collection = await this.collection()
  //
  //   await collection.updateOne(
  //     {
  //       churchId: scheduleItem.getChurchId(),
  //       scheduleItemId: scheduleItem.getScheduleItemId(),
  //     },
  //     {
  //       $set: scheduleItem.toPrimitives() as any,
  //     },
  //     { upsert: true }
  //   )
  // }
  //
  // async update(scheduleItem: ScheduleItem): Promise<void> {
  //   await this.ensureIndexes()
  //   const collection = await this.collection()
  //
  //   await collection.updateOne(
  //     {
  //       churchId: scheduleItem.getChurchId(),
  //       scheduleItemId: scheduleItem.getScheduleItemId(),
  //     },
  //     {
  //       $set: scheduleItem.toPrimitives() as any,
  //     }
  //   )
  // }

  // async findById(
  //   churchId: string,
  //   scheduleItemId: string
  // ): Promise<ScheduleItem | null> {
  //   const collection = await this.collection()
  //   const result = await collection.findOne({ churchId, scheduleItemId })
  //
  //   if (!result) {
  //     return null
  //   }
  //
  //   return ScheduleItem.fromPrimitives({
  //     id: result._id,
  //     ...result,
  //   })
  // }

  async one(filter: object): Promise<ScheduleItem | undefined> {
    const collection = await this.collection()
    const data = await collection.findOne(filter)
    if (!data) {
      return undefined
    }
    return ScheduleItem.fromPrimitives({
      id: data._id,
      ...data,
    })
  }

  async list(criteria: Criteria): Promise<Paginate<ScheduleItem>> {
    const result = await this.searchByCriteria<ScheduleItem>(criteria)
    return this.paginate<ScheduleItem>(result)
  }

  async findManyByChurch(
    churchId: string,
    filters?: any
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
}
