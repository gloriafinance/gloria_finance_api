import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { NotificationsTopic } from "@/PushNotifications/domain"

export class NotificationInbox extends AggregateRoot {
  private id?: string
  private memberId: string
  private type: NotificationsTopic
  private body: string
  private title: string
  private data: any
  private readAt: Date | null
  private createdAt: Date

  static create(params: {
    memberId: string
    type: NotificationsTopic
    body: string
    title: string
    data?: any
  }): NotificationInbox {
    const notification = new NotificationInbox()
    notification.memberId = params.memberId
    notification.type = params.type
    notification.body = params.body
    notification.title = params.title
    notification.data = params.data
    notification.readAt = null
    notification.createdAt = new Date()
    return notification
  }

  static override fromPrimitives(params: any): NotificationInbox {
    const notification = new NotificationInbox()
    notification.id = params.id
    notification.memberId = params.memberId
    notification.type = params.type
    notification.body = params.body
    notification.title = params.title
    notification.data = params.data
    notification.readAt = params.readAt ? new Date(params.readAt) : null
    notification.createdAt = new Date(params.createdAt)

    return notification
  }

  getId(): string {
    return this.id
  }

  toPrimitives(): any {
    return {
      userId: this.memberId,
      type: this.type,
      body: this.body,
      title: this.title,
      data: this.data,
      readAt: this.readAt,
      createdAt: this.createdAt,
    }
  }
}
