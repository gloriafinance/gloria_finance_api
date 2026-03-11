import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  Devotional,
  DevotionalStatus,
  type DevotionalDayOfWeek,
  type IDevotionalRepository,
} from "@/Church/domain"
import type { Collection } from "mongodb"

export class DevotionalMongoRepository
  extends MongoRepository<Devotional>
  implements IDevotionalRepository
{
  private static instance: DevotionalMongoRepository

  private constructor() {
    super(Devotional)
  }

  static getInstance(): DevotionalMongoRepository {
    if (!DevotionalMongoRepository.instance) {
      DevotionalMongoRepository.instance = new DevotionalMongoRepository()
    }
    return DevotionalMongoRepository.instance
  }

  collectionName(): string {
    return "devotionals"
  }

  async upsert(devotional: Devotional): Promise<void> {
    const collection = await this.collection()
    const payload = devotional.toPrimitives()

    await collection.updateOne(
      {
        churchId: payload.churchId,
        devotionalId: payload.devotionalId,
      },
      { $set: payload },
      { upsert: true }
    )
  }

  async findByDevotionalId(
    churchId: string,
    devotionalId: string
  ): Promise<Devotional | undefined> {
    const collection = await this.collection()
    const document = await collection.findOne({ churchId, devotionalId })
    if (!document) {
      return undefined
    }
    return Devotional.fromPrimitives({
      id: document._id.toString(),
      ...document,
    })
  }

  async findByChurchAndWeek(
    churchId: string,
    weekStartDate: string
  ): Promise<Devotional[]> {
    const collection = await this.collection()
    const result = await collection
      .find({ churchId, weekStartDate })
      .sort({ scheduledAt: 1 })
      .toArray()

    return result.map((item) =>
      Devotional.fromPrimitives({ id: item._id.toString(), ...item })
    )
  }

  async deleteByChurchWeekAndDays(
    churchId: string,
    weekStartDate: string,
    days: DevotionalDayOfWeek[]
  ): Promise<void> {
    if (!days.length) {
      return
    }

    const collection = await this.collection()
    await collection.deleteMany({
      churchId,
      weekStartDate,
      dayOfWeek: { $in: days },
      status: {
        $in: [
          DevotionalStatus.PENDING,
          DevotionalStatus.GENERATING,
          DevotionalStatus.IN_REVIEW,
          DevotionalStatus.APPROVED,
          DevotionalStatus.FAILED,
        ],
      },
    })
  }

  async claimGeneration(
    churchId: string,
    devotionalId: string
  ): Promise<boolean> {
    const collection = await this.collection()
    const result = await collection.updateOne(
      {
        churchId,
        devotionalId,
        status: DevotionalStatus.PENDING,
      },
      {
        $set: {
          status: DevotionalStatus.GENERATING,
          updatedAt: new Date(),
          failureReason: undefined,
          failedAt: undefined,
        },
      }
    )

    return result.modifiedCount === 1
  }

  async listDueForGeneration(
    churchId: string,
    now: Date
  ): Promise<Devotional[]> {
    const collection = await this.collection()

    const result = await collection
      .find({
        churchId,
        status: DevotionalStatus.PENDING,
        scheduledAt: { $lte: now },
      })
      .sort({ scheduledAt: 1 })
      .toArray()

    return result.map((item) =>
      Devotional.fromPrimitives({ id: item._id.toString(), ...item })
    )
  }

  async listByStatus(
    churchId: string,
    status: DevotionalStatus
  ): Promise<Devotional[]> {
    const collection = await this.collection()
    const result = await collection.find({ churchId, status }).toArray()

    return result.map((item) =>
      Devotional.fromPrimitives({ id: item._id.toString(), ...item })
    )
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex(
      { churchId: 1, devotionalId: 1 },
      { unique: true }
    )
    await collection.createIndex(
      { churchId: 1, devotionalWeeklyPlanId: 1, scheduleDate: 1 },
      { unique: true }
    )
    await collection.createIndex({
      churchId: 1,
      weekStartDate: 1,
      scheduledAt: 1,
    })
    await collection.createIndex({ churchId: 1, status: 1, scheduledAt: 1 })
  }
}
