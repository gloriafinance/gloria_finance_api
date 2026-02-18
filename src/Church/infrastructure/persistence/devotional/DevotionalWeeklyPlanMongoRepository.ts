import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  DevotionalWeeklyPlan,
  type IDevotionalWeeklyPlanRepository,
} from "@/Church/domain"
import type { Collection } from "mongodb"

export class DevotionalWeeklyPlanMongoRepository
  extends MongoRepository<DevotionalWeeklyPlan>
  implements IDevotionalWeeklyPlanRepository
{
  private static instance: DevotionalWeeklyPlanMongoRepository

  private constructor() {
    super(DevotionalWeeklyPlan)
  }

  static getInstance(): DevotionalWeeklyPlanMongoRepository {
    if (!DevotionalWeeklyPlanMongoRepository.instance) {
      DevotionalWeeklyPlanMongoRepository.instance =
        new DevotionalWeeklyPlanMongoRepository()
    }
    return DevotionalWeeklyPlanMongoRepository.instance
  }

  collectionName(): string {
    return "devotional_weekly_plans"
  }

  async upsert(plan: DevotionalWeeklyPlan): Promise<void> {
    const collection = await this.collection()
    const payload = plan.toPrimitives()

    await collection.updateOne(
      {
        churchId: payload.churchId,
        weekStartDate: payload.weekStartDate,
      },
      {
        $set: payload,
      },
      { upsert: true }
    )
  }

  async findByChurchAndWeek(
    churchId: string,
    weekStartDate: string
  ): Promise<DevotionalWeeklyPlan | undefined> {
    const collection = await this.collection()
    const data = await collection.findOne({ churchId, weekStartDate })

    if (!data) {
      return undefined
    }

    return DevotionalWeeklyPlan.fromPrimitives({
      id: data._id.toString(),
      ...data,
    })
  }

  async listEnabledByWeek(
    weekStartDate: string
  ): Promise<DevotionalWeeklyPlan[]> {
    const collection = await this.collection()
    const result = await collection
      .find({ weekStartDate, isEnabled: true })
      .toArray()

    return result.map((item) =>
      DevotionalWeeklyPlan.fromPrimitives({
        id: item._id.toString(),
        ...item,
      })
    )
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex(
      { churchId: 1, weekStartDate: 1 },
      { unique: true }
    )
    await collection.createIndex({ churchId: 1, isEnabled: 1 })
  }
}
