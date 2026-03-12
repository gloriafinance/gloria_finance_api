import { ChurchStatus, type IChurchRepository } from "@/Church/domain"
import type { IScheduleItemRepository } from "@/Schedule/domain"
import { Logger } from "@/Shared/adapter"
import {
  type IJob,
  type IQueueService,
  QueueName,
} from "@/package/queue/domain"
import {
  type NotificationRequest,
  NotificationsTopic,
} from "@/PushNotifications/domain"

export class NotifyScheduleDay implements IJob {
  private readonly logger = Logger(NotifyScheduleDay.name)

  constructor(
    private readonly churchRepository: IChurchRepository,
    private readonly scheduleRepository: IScheduleItemRepository,
    private queueService: IQueueService
  ) {}

  async handle(args: any) {
    const churches = await this.churchRepository.all({
      status: ChurchStatus.ACTIVE,
    })

    for (const church of churches) {
      const scheduleItems = await this.scheduleRepository.findTodayByChurch(
        church.getChurchId()
      )

      this.logger.info(
        `The church ${church.getName()} have ${scheduleItems?.getTitle()} today`
      )

      if (!scheduleItems) {
        continue
      }

      this.logger.info(
        `Notifying schedule day for church ${church.getName()} event: ${scheduleItems.getTitle()}`
      )

      // TODO it is notifying everyone, however the evaluation of the visibility field must be implemented
      this.queueService.dispatch<NotificationRequest>(QueueName.NotifyFCMJob, {
        churchId: church.getChurchId(),
        title: "Schedule Day",
        body:
          scheduleItems.getTitle() +
          " at " +
          new Date().toLocaleString("en-US", { timeZone: "UTC" }),
        data: {
          type: NotificationsTopic.EVENT_NEW,
          id: scheduleItems.getScheduleItemId(),
          deepLink: `https://yourapp.com/schedule/${scheduleItems.getScheduleItemId()}`,
        },
      })
    }

    this.logger.info(`Deactivate previous events`)

    await this.scheduleRepository.deactivatePreviousDayEvents()

    this.logger.info(`Finish NotifyScheduleDay`)
  }
}
