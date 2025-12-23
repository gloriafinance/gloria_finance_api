import { Criteria, Paginate } from "@abejarano/ts-mongodb-criteria"
import { NotificationInbox } from "@/Notifications/domain"

export interface INotificationRepository {
  upsert(notification: NotificationInbox): Promise<void>

  list(criteria: Criteria): Promise<Paginate<NotificationInbox>>

  deleteByUserId(userId: string): Promise<void>
}
