import { NotificationsTopic } from "@/PushNotifications/domain"

export type NotificationRequest = {
  churchId: string
  memberId?: string[]
  title: string
  body: string
  data: {
    type: NotificationsTopic
    id: string
    deepLink?: string
  }
}
