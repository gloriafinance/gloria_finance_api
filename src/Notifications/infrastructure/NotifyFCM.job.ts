import { IMemberRepository, Member } from "@/Church/domain"
import { Logger } from "@/Shared/adapter"
import {
  INotificationRepository,
  NotificationInbox,
  NotificationRequest,
  NotificationsTopic,
} from "@/Notifications/domain"
import { IJob } from "@/Shared/domain"
import { FCMNotificationService } from "./services/FCMNotification.service"

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

    args.data = { ...args.data, deepLink: this.getDeepLink(args.data) }

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
      active: true,
    })

    await this.notifyMembers({ ...args, members })
  }

  // Genera el deep link según el tipo de notificación, para que la app abra la pantalla correcta
  private getDeepLink(data: any): string {
    switch (data.type) {
      case NotificationsTopic.EVENT_NEW:
        return `/events/${data.id}`
      case NotificationsTopic.PAYMENT_COMMITMENT_DUE:
        return `news/${data.id}`
      case NotificationsTopic.CONTRIBUTION_STATUS_CHANGED:
        return `/notifications/${data.id}`
      default:
        return `/home`
    }
  }
}
