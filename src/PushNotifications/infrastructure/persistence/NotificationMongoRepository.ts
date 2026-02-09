import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  type INotificationRepository,
  NotificationInbox,
} from "@/PushNotifications/domain"
import { Collection } from "mongodb"

export class NotificationMongoRepository
  extends MongoRepository<NotificationInbox>
  implements INotificationRepository
{
  private static instance: NotificationMongoRepository

  private constructor() {
    super(NotificationInbox)
  }

  static getInstance(): NotificationMongoRepository {
    if (!NotificationMongoRepository.instance) {
      NotificationMongoRepository.instance = new NotificationMongoRepository()
    }

    return NotificationMongoRepository.instance
  }

  collectionName(): string {
    return "notification_inbox"
  }

  async deleteByUserId(userId: string): Promise<void> {
    const collection = await this.collection()

    await collection.deleteMany({ userId })
  }

  protected ensureIndexes(collection: Collection): Promise<void> {
    return Promise.resolve(undefined)
  }
}
