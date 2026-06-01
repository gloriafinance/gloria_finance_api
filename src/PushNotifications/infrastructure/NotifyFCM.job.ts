import { type IMemberRepository, Member } from "@/Church/domain"
import { Logger } from "@/Shared/adapter"
import {
  type INotificationRepository,
  NotificationInbox,
  type NotificationRequest,
  NotificationsTopic,
} from "@/PushNotifications/domain"
import { FCMNotificationService } from "./services/FCMNotification.service"
import type { IJob } from "@/package/queue/domain"

export class NotifyFCMJob implements IJob {
  private logger = Logger(NotifyFCMJob.name)

  constructor(
    private readonly memberRepository: IMemberRepository,
    private readonly notificationRepository: INotificationRepository,
    private readonly fcmService: FCMNotificationService
  ) {}

  async handle(args: NotificationRequest): Promise<any> {
    this.logger.info(`Processing FCM job for member ${args.memberId}`, args)

    if (!args.memberId || args.memberId.length === 0) {
      // es para notificar a todos los miembros
      return this.notifyAllMembers(args)
    }

    const members = await this.memberRepository.list({
      memberId: { $in: args.memberId },
    })

    await this.notifyMembers({ ...args, members })
  }

  private async notifyMembers(
    args: NotificationRequest & { members: Member[] }
  ) {
    const { members } = args

    args.data = {
      ...args.data,
      deepLink: this.resolveDeepLink(args.data),
    }

    const tokenList: string[] = []

    for (const member of members) {
      const settings = member.getSettings()
      if (settings.token) {
        tokenList.push(settings.token)

        await this.notificationRepository.upsert(
          NotificationInbox.create({
            memberId: member.getMemberId(),
            type: args.data.type,
            body: args.body,
            title: args.title,
            data: args.data,
          })
        )
      }
    }

    await this.fcmService.sendToTokens(tokenList, {
      title: args.title,
      body: args.body,
      data: args.data,
    })

    this.logger.info(`finished FCM job for member ${args.memberId}`)
  }

  private async notifyAllMembers(args: NotificationRequest): Promise<void> {
    const members = await this.memberRepository.all(args.churchId, {
      status: "APPROVED",
    })

    await this.notifyMembers({ ...args, members })
  }

  // Genera el deep link según el tipo de notificación, para que la app abra la pantalla correcta
  private resolveDeepLink(data: any): string {
    const explicitDeepLink = this.normalizeIncomingDeepLink(data?.deepLink)
    if (explicitDeepLink) {
      return explicitDeepLink
    }

    return this.getDeepLinkByType(data)
  }

  private getDeepLinkByType(data: any): string {
    switch (data.type) {
      case NotificationsTopic.EVENT_NEW:
        return `/member/schedule`
      case NotificationsTopic.PAYMENT_COMMITMENT_DUE:
        return `/member/commitments`
      case NotificationsTopic.CONTRIBUTION_STATUS_CHANGED:
        return `/member/contribute`
      case NotificationsTopic.SYSTEM_ANNOUNCEMENT:
        return `/dashboard`
      default:
        return `/dashboard`
    }
  }

  private normalizeIncomingDeepLink(value: unknown): string | undefined {
    const raw = String(value ?? "").trim()
    if (!raw) {
      return undefined
    }

    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      try {
        const parsed = new URL(raw)
        const path = `${parsed.pathname || ""}${parsed.search || ""}${parsed.hash || ""}`
        return path.startsWith("/") ? path : `/${path}`
      } catch {
        return undefined
      }
    }

    if (raw.startsWith("/")) {
      return raw
    }

    return `/${raw}`
  }
}
