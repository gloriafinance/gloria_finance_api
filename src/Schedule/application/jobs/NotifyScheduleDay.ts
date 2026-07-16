import {
  type Church,
  ChurchStatus,
  type IChurchRepository,
} from "@/Church/domain"
import {
  type IScheduleItemRepository,
  type IScheduleReminderService,
  type ScheduleEvent,
  ScheduleEventStatus,
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
import { NotificationEventsAgent } from "@/Schedule/application/jobs/agents/NotificationEvents.agent.ts"

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
        status: ScheduleEventStatus.ACTIVE,
      }
    )

    await Promise.all(
      scheduleItems.map((scheduleItem) =>
        this.processScheduleReminder(church, scheduleItem, referenceDate)
      )
    )

    await this.finalizedEvents(
      church.getChurchId(),
      scheduleItems,
      referenceDate
    )
  }

  private async processScheduleReminder(
    church: Church,
    scheduleItem: ScheduleEvent,
    referenceDate: Date
  ): Promise<void> {
    const scheduleTimezone = scheduleItem.getRecurrencePattern().timezone
    const notificationDateKey =
      this.scheduleReminderService.notificationDateKey(
        scheduleItem,
        scheduleTimezone,
        referenceDate
      )
    const schedulingLockKey = `schedule-day:queued:${church.getChurchId()}:${scheduleItem.getScheduleItemId()}:${notificationDateKey}`

    if (
      !this.scheduleReminderService.shouldQueueReminder(
        scheduleItem,
        scheduleTimezone,
        referenceDate,
        church.getNotificationTime()
      )
    ) {
      this.logger.info(`It is not to remember the event`)
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

    const notificationData = await new NotificationEventsAgent().execute({
      church_doctrinal_profile_text: church.getDoctrinalBases().join(". "),
      lang: church.getLang(),
      title: scheduleItem.getTitle(),
      activityType: scheduleItem.getType(),
      time: scheduleItem.getRecurrencePattern().time,
    })

    // TODO it is notifying everyone, however the evaluation of the visibility field must be implemented
    this.queueService.dispatch<NotificationRequest>(
      QueueName.NotifyFCMJob,
      {
        churchId: church.getChurchId(),
        title: notificationData.title,
        body: notificationData.body,
        data: {
          type: NotificationsTopic.EVENT_NEW,
          id: scheduleItem.getScheduleItemId(),
          deepLink: "/member/schedule",
        },
      },
      {
        jobId: `schedule-day-${church.getChurchId()}-${scheduleItem.getScheduleItemId()}-${notificationDateKey}`,
        delayMs: this.scheduleReminderService.reminderDelayMs(
          scheduleTimezone,
          referenceDate,
          church.getNotificationTime()
        ),
      }
    )
    await this.cacheService.set(schedulingLockKey, true, 60 * 60 * 48)
  }

  private async finalizedEvents(
    churchId: string,
    scheduleItems: Awaited<
      ReturnType<IScheduleItemRepository["findManyByChurch"]>
    >,
    referenceDate: Date
  ): Promise<void> {
    await Promise.all(
      scheduleItems.map(async (scheduleItem) => {
        const scheduleTimezone = scheduleItem.getRecurrencePattern().timezone
        if (
          !this.scheduleReminderService.isExpired(
            scheduleItem,
            scheduleTimezone,
            referenceDate
          )
        ) {
          return
        }

        scheduleItem.finalize()
        await this.scheduleRepository.upsert(scheduleItem)

        this.logger.info(
          `Deactivated expired schedule item ${scheduleItem.getScheduleItemId()} for church ${churchId}`
        )
      })
    )
  }
}
