import { type App, getApps, initializeApp } from "firebase-admin/app"
import {
  getMessaging,
  type Message,
  Messaging,
  type MulticastMessage,
} from "firebase-admin/messaging"

import { credential } from "firebase-admin"
import { NotificationsTopic } from "@/PushNotifications/domain"
import applicationDefault = credential.applicationDefault

export type FCMNotificationPayload = {
  title: string
  body: string
  data?: Record<string, string> // FCM requiere strings
}

export class FCMNotificationService {
  private static instance: FCMNotificationService
  private app?: App
  private messaging?: Messaging
  private initialized = false

  private constructor() {}

  static getInstance(): FCMNotificationService {
    if (!FCMNotificationService.instance) {
      FCMNotificationService.instance = new FCMNotificationService()
    }
    return FCMNotificationService.instance
  }

  async sendToToken(
    token: string,
    payload: FCMNotificationPayload
  ): Promise<void> {
    this.initOnce()

    const msg: Message = {
      token,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
    }

    await this.messaging!.send(msg)
    //return { messageId }
  }

  /**
   * Envia a muchos tokens (hasta 500 por request).
   * Útil si luego migras a tabla de tokens por device.
   */
  async sendToTokens(
    tokens: string[],
    payload: FCMNotificationPayload
  ): Promise<void> {
    this.initOnce()

    const multicast: MulticastMessage = {
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
    }

    // sendEachForMulticast es la opción moderna en SDK actuales
    await this.messaging!.sendEachForMulticast(multicast)
  }

  async sendToTopic(
    topic: NotificationsTopic,
    payload: FCMNotificationPayload
  ): Promise<void> {
    this.initOnce()

    const msg: Message = {
      topic,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
    }

    await this.messaging!.send(msg)
  }

  private initOnce() {
    if (this.initialized) return

    if (getApps().length > 0) {
      this.app = getApps()[0]
      this.messaging = getMessaging(this.app)
      this.initialized = true
      return
    }

    this.app = initializeApp({
      credential: applicationDefault(),
    })

    this.messaging = getMessaging(this.app)
    this.initialized = true
  }
}
