import {
  Criteria,
  MongoRepository,
  Paginate,
} from "@abejarano/ts-mongodb-criteria"
import {
  INotificationRepository,
  NotificationInbox,
} from "@/Notifications/domain"

export class NotificationMongoRepository
  extends MongoRepository<NotificationInbox>
  implements INotificationRepository
{
  private static instance: NotificationMongoRepository

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

  async upsert(notification: NotificationInbox): Promise<void> {
    await this.persist(notification.getId(), notification)
  }

  async list(criteria: Criteria): Promise<Paginate<NotificationInbox>> {
    const data = await this.searchByCriteria<NotificationInbox>(criteria)
    return this.paginate(data)
  }
}
