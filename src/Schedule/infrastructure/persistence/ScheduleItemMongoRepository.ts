import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { IScheduleItemRepository, ScheduleEvent } from "@/Schedule/domain"

export class ScheduleItemMongoRepository
  extends MongoRepository<ScheduleEvent>
  implements IScheduleItemRepository
{
  private static instance: ScheduleItemMongoRepository
  private indexesInitialized = false

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

  async one(filter: object): Promise<ScheduleEvent | undefined> {
    const collection = await this.collection()
    const data = await collection.findOne(filter)
    if (!data) {
      return undefined
    }
    return ScheduleEvent.fromPrimitives({
      id: data._id,
      ...data,
    })
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

    if (filters?.isActive !== undefined) {
      query.isActive = filters.isActive
    }

    const result = await collection.find(query).toArray()

    return result.map((document) =>
      ScheduleEvent.fromPrimitives({
        id: document._id,
        ...document,
      })
    )
  }
}
