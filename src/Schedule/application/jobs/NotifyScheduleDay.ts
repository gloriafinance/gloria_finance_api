import {
  ChurchStatus,
  type Church,
  type IChurchRepository,
} from "@/Church/domain"
import {
  type IScheduleItemRepository,
  type IScheduleReminderService,
  type ScheduleEvent,
} from "@/Schedule/domain"
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
import type { ICacheService } from "@/Shared/domain"

export class NotifyScheduleDay implements IJob {
  private readonly logger = Logger(NotifyScheduleDay.name)

  constructor(
    private readonly churchRepository: IChurchRepository,
    private readonly scheduleRepository: IScheduleItemRepository,
    private queueService: IQueueService,
    private readonly scheduleReminderService: IScheduleReminderService,
    private readonly cacheService: ICacheService
  ) {}

  async handle(args: any) {
    const referenceDate = args?.referenceDate
      ? new Date(args.referenceDate)
      : new Date()
    const churches = await this.churchRepository.all({
      status: ChurchStatus.ACTIVE,
    })

    await Promise.all(
      churches.map((church) => this.processChurch(church, referenceDate))
    )

    this.logger.info(`Finish NotifyScheduleDay`)
  }

  private async processChurch(
    church: Church,
    referenceDate: Date
  ): Promise<void> {
    const scheduleItems = await this.scheduleRepository.findManyByChurch(
      church.getChurchId(),
      {
        isActive: true,
      }
    )

    await Promise.all(
      scheduleItems.map((scheduleItem) =>
        this.processScheduleReminder(church, scheduleItem, referenceDate)
      )
    )

    await this.deactivateExpiredEvents(
      church.getChurchId(),
      church.getTimezone(),
      scheduleItems,
      referenceDate
    )
  }

  private async processScheduleReminder(
    church: Church,
    scheduleItem: ScheduleEvent,
    referenceDate: Date
  ): Promise<void> {
    const notificationDateKey =
      this.scheduleReminderService.notificationDateKey(
        scheduleItem,
        church.getTimezone(),
        referenceDate
      )
    const schedulingLockKey = `schedule-day:queued:${church.getChurchId()}:${scheduleItem.getScheduleItemId()}:${notificationDateKey}`

    if (
      !this.scheduleReminderService.shouldQueueReminder(
        scheduleItem,
        church.getTimezone(),
        referenceDate
      )
    ) {
      return
    }

    if (await this.cacheService.get<boolean>(schedulingLockKey)) {
      this.logger.info(
        `Skipping already queued schedule reminder ${schedulingLockKey}`
      )
      return
    }

    this.logger.info(
      `Notifying schedule day for church ${church.getName()} event: ${scheduleItem.getTitle()}`
    )

    // TODO it is notifying everyone, however the evaluation of the visibility field must be implemented
    this.queueService.dispatch<NotificationRequest>(
      QueueName.NotifyFCMJob,
      {
        churchId: church.getChurchId(),
        title: "Schedule Day",
        body: `${scheduleItem.getTitle()} at ${this.scheduleReminderService.formatScheduledDateTime(
          scheduleItem,
          church.getTimezone(),
          referenceDate
        )}`,
        data: {
          type: NotificationsTopic.EVENT_NEW,
          id: scheduleItem.getScheduleItemId(),
          deepLink: "/member/schedule",
        },
      },
      {
        jobId: `schedule-day:${church.getChurchId()}:${scheduleItem.getScheduleItemId()}:${notificationDateKey}`,
        delayMs: this.scheduleReminderService.reminderDelayMs(
          scheduleItem,
          church.getTimezone(),
          referenceDate
        ),
      }
    )
    await this.cacheService.set(schedulingLockKey, true, 60 * 60 * 48)
  }

  private async deactivateExpiredEvents(
    churchId: string,
    churchTimezone: string,
    scheduleItems: Awaited<
      ReturnType<IScheduleItemRepository["findManyByChurch"]>
    >,
    referenceDate: Date
  ): Promise<void> {
    await Promise.all(
      scheduleItems.map(async (scheduleItem) => {
        if (
          !this.scheduleReminderService.isExpired(
            scheduleItem,
            churchTimezone,
            referenceDate
          )
        ) {
          return
        }

        scheduleItem.deactivate()
        await this.scheduleRepository.upsert(scheduleItem)

        this.logger.info(
          `Deactivated expired schedule item ${scheduleItem.getScheduleItemId()} for church ${churchId}`
        )
      })
    )
  }
}
