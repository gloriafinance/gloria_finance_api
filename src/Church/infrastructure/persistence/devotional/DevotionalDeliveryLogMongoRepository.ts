import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  DevotionalDeliveryLog,
  type IDevotionalDeliveryLogRepository,
  type ListDevotionalHistoryRequest,
} from "@/Church/domain"
import type { Collection } from "mongodb"

export class DevotionalDeliveryLogMongoRepository
  extends MongoRepository<DevotionalDeliveryLog>
  implements IDevotionalDeliveryLogRepository
{
  private static instance: DevotionalDeliveryLogMongoRepository

  private constructor() {
    super(DevotionalDeliveryLog)
  }

  static getInstance(): DevotionalDeliveryLogMongoRepository {
    if (!DevotionalDeliveryLogMongoRepository.instance) {
      DevotionalDeliveryLogMongoRepository.instance =
        new DevotionalDeliveryLogMongoRepository()
    }
    return DevotionalDeliveryLogMongoRepository.instance
  }

  collectionName(): string {
    return "devotional_delivery_logs"
  }

  async search(
    request: ListDevotionalHistoryRequest
  ): Promise<DevotionalDeliveryLog[]> {
    const collection = await this.collection()

    const query: Record<string, any> = {
      churchId: request.churchId,
    }

    if (request.fromDate || request.toDate) {
      query.scheduleDate = {}
      if (request.fromDate) {
        query.scheduleDate.$gte = request.fromDate
      }
      if (request.toDate) {
        query.scheduleDate.$lte = request.toDate
      }
    }

    if (request.audience) {
      query.audience = request.audience
    }

    if (request.overall) {
      query["results.overall"] = request.overall
    }

    if (request.channel === "push") {
      query["channels.pushEnabled"] = true
    }

    if (request.channel === "whatsapp") {
      query["channels.whatsappEnabled"] = true
    }

    if (request.query?.trim()) {
      query.$or = [
        { themeWeek: { $regex: request.query.trim(), $options: "i" } },
        {
          "contentSnapshot.title": {
            $regex: request.query.trim(),
            $options: "i",
          },
        },
      ]
    }

    const result = await collection
      .find(query)
      .sort({ attemptedAt: -1 })
      .limit(200)
      .toArray()

    return result.map((item) =>
      DevotionalDeliveryLog.fromPrimitives({
        id: item._id.toString(),
        ...item,
      })
    )
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex({ churchId: 1, attemptedAt: -1 })
    await collection.createIndex({ churchId: 1, scheduleDate: -1 })
    await collection.createIndex({ devotionalId: 1 })
  }
}
