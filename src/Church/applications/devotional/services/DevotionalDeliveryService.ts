import {
  Church,
  Devotional,
  DevotionalAudience,
  DevotionalChannelResult,
  DevotionalDeliveryLog,
  DevotionalNotFound,
  DevotionalPlanException,
  DevotionalStatus,
  type IChurchRepository,
  type IDevotionalDeliveryLogRepository,
  type IDevotionalRepository,
  type IMemberRepository,
} from "@/Church/domain"
import { FindChurchById } from "@/Church/applications/church/FindChurchById"
import { SendWhatsappTextMessage } from "@/Church/applications/whatsapp/SendWhatsappTextMessage"
import { type IQueueService, QueueName } from "@/package/queue/domain"
import { NotificationsTopic } from "@/PushNotifications/domain"
import { Logger } from "@/Shared/adapter"

export class DevotionalDeliveryService {
  private logger = Logger(DevotionalDeliveryService.name)

  constructor(
    private readonly devotionalRepository: IDevotionalRepository,
    private readonly deliveryLogRepository: IDevotionalDeliveryLogRepository,
    private readonly churchRepository: IChurchRepository,
    private readonly memberRepository: IMemberRepository,
    private readonly queueService: IQueueService
  ) {}

  async retrySend(churchId: string, devotionalId: string): Promise<Devotional> {
    this.logger.info(`Starting retry send devotional ${devotionalId}`)

    const devotional = await this.devotionalRepository.findByDevotionalId(
      churchId,
      devotionalId
    )

    if (!devotional) {
      this.logger.error(`Devotional not found`)
      throw new DevotionalNotFound()
    }

    const church = await new FindChurchById(this.churchRepository).execute(
      churchId
    )

    await this.sendDevotionalNow(devotional, church, true)
    return devotional
  }

  async sendScheduled(churchId: string, devotionalId: string): Promise<void> {
    const devotional = await this.devotionalRepository.findByDevotionalId(
      churchId,
      devotionalId
    )
    if (!devotional) {
      this.logger.info(`Devotional not found`)
      return
    }

    if (devotional.getStatus() !== DevotionalStatus.APPROVED) {
      this.logger.info(
        `it is not possible to send the devotional because it has status ${devotional.getStatus()}`
      )
      return
    }

    const diff = devotional.getScheduledAt().getTime() - Date.now()
    if (diff > 1000) {
      this.queueService.dispatch(
        QueueName.SendScheduledDevotionalJob,
        { churchId, devotionalId },
        {
          delayMs: diff,
        }
      )
      return
    }

    const church = await this.churchRepository.one({ churchId })
    if (!church) {
      devotional.markFailed("Church not found")
      await this.devotionalRepository.upsert(devotional)
      return
    }

    await this.sendDevotionalNow(devotional, church)
  }

  async notifyPastorsForReview(
    church: Church,
    devotional: Devotional
  ): Promise<void> {
    this.logger.info(`notify the pastor to review the devotional`)

    const pastor = await this.memberRepository.one({
      churchId: church.getChurchId(),
      status: "APPROVED",
      isMinister: true,
    })

    if (!pastor) {
      this.logger.debug(`pastor not found`)
      return
    }

    const content = devotional.getContent()
    if (!content) {
      return
    }

    const title =
      church.getLang() === "es"
        ? "Devocional listo para revisión"
        : "Devocional está pronto para revisão"

    const body =
      church.getLang() === "es"
        ? `"${content.title}" está en revisión y espera aprobación.`
        : `"${content.title}" está em revisão e espera aprovação.`

    if (church.isWhatsappConnected()) {
      const settings = pastor.getSettings()
      const phone = String(pastor.getPhone() ?? "").replace(/[^\d]/g, "")
      const whatsappPastor = Boolean(
        settings?.whatsappOptIn && phone.length >= 10
      )

      if (whatsappPastor) {
        try {
          await new SendWhatsappTextMessage(this.churchRepository).execute({
            churchId: church.getChurchId(),
            to: phone,
            body,
            previewUrl: false,
          })
        } catch (e) {
          this.logger.info(`Failure to notify the pastor via WhatsApp`)

          this.queueService.dispatch(QueueName.TelegramNotificationJob, {
            message: `Error al enviar notificación al pastor via whatsapp acerca de la aprobación de devocional ${JSON.stringify(e)}`,
          })
        }
      }
    }

    this.queueService.dispatch(QueueName.NotifyFCMJob, {
      churchId: church.getChurchId(),
      memberId: [pastor.getMemberId()],
      title,
      body,
      data: {
        type: NotificationsTopic.SYSTEM_ANNOUNCEMENT,
        id: devotional.getDevotionalId(),
        deepLink: this.buildDevotionalDeepLink(devotional.getDevotionalId()),
      },
    })
  }

  scheduleDelivery(devotional: Devotional): void {
    const delayMs = Math.max(
      devotional.getScheduledAt().getTime() - Date.now(),
      0
    )
    const safeJobId = `send-devotional-${devotional
      .getIdempotencyBaseKey()
      .replace(/[:]/g, "-")}`

    this.queueService.dispatch(
      QueueName.SendScheduledDevotionalJob,
      {
        churchId: devotional.getChurchId(),
        devotionalId: devotional.getDevotionalId(),
      },
      {
        delayMs,
        jobId: safeJobId,
      }
    )
  }

  private async sendDevotionalNow(
    devotional: Devotional,
    church: any,
    force = false
  ) {
    const snapshot = devotional.getPlanSnapshot()
    const content = devotional.getContent()

    if (!content) {
      this.logger.info(`Devotional content is not generated`)
      throw new DevotionalPlanException("Devotional content is not generated")
    }

    devotional.markSending()
    await this.devotionalRepository.upsert(devotional)

    let pushResult: DevotionalChannelResult = snapshot.channels.pushEnabled
      ? DevotionalChannelResult.FAILED
      : DevotionalChannelResult.NOT_ENABLED
    let whatsappResult: DevotionalChannelResult = snapshot.channels
      .whatsappEnabled
      ? DevotionalChannelResult.FAILED
      : DevotionalChannelResult.NOT_ENABLED

    const errors: string[] = []

    if (snapshot.channels.pushEnabled) {
      try {
        if (!devotional.wasPushDelivered() || force) {
          this.logger.info(`sending via push notification`)

          const audienceMembers = await this.resolveAudienceMembers(
            devotional.getChurchId(),
            snapshot.audience
          )

          this.queueService.dispatch(QueueName.NotifyFCMJob, {
            churchId: devotional.getChurchId(),
            memberId: audienceMembers.map((member) => member.getMemberId()),
            title: content.pushTitle,
            body: content.pushBody,
            data: {
              type: NotificationsTopic.SYSTEM_ANNOUNCEMENT,
              id: devotional.getDevotionalId(),
              deepLink: this.buildDevotionalDeepLink(
                devotional.getDevotionalId()
              ),
            },
          })
        }
        pushResult = DevotionalChannelResult.SENT
      } catch (error: any) {
        this.logger.error(
          `Push delivery failed: ${error?.message ?? "unknown"}`
        )
        errors.push(`Push delivery failed: ${error?.message ?? "unknown"}`)
        pushResult = DevotionalChannelResult.FAILED
      }
    }

    if (snapshot.channels.whatsappEnabled) {
      if (!church.isWhatsappConnected()) {
        this.logger.error(
          "WhatsApp channel is enabled but church is disconnected"
        )

        errors.push("WhatsApp channel is enabled but church is disconnected")
        whatsappResult = DevotionalChannelResult.FAILED
      } else {
        //TODO debe ser refactorizado para que sea de forma asincrona, es decir disparar job por mensaje
        try {
          if (!devotional.wasWhatsappDelivered() || force) {
            this.logger.info(`sending via whatsapp`)

            const summary = await this.sendWhatsappToAudience(devotional)

            if (summary.sent > 0 && summary.failed === 0) {
              whatsappResult = DevotionalChannelResult.SENT
            } else if (summary.sent > 0 && summary.failed > 0) {
              whatsappResult = DevotionalChannelResult.FAILED
              errors.push(
                `WhatsApp partial delivery: ${summary.failed} failures`
              )
            } else {
              whatsappResult = DevotionalChannelResult.FAILED
              errors.push("No opted-in recipients found for WhatsApp")
            }
          } else {
            whatsappResult = DevotionalChannelResult.SENT
          }
        } catch (error: any) {
          errors.push(
            `WhatsApp delivery failed: ${error?.message ?? "unknown"}`
          )
          whatsappResult = DevotionalChannelResult.FAILED
        }
      }
    }

    const overall = this.resolveOverallStatus(pushResult, whatsappResult)

    if (overall === "sent") {
      devotional.markSent({ push: pushResult, whatsapp: whatsappResult })
    } else {
      devotional.markFailed(errors.join(" | ") || "Delivery failed", {
        push: pushResult,
        whatsapp: whatsappResult,
      })
    }

    await this.devotionalRepository.upsert(devotional)

    const latestVersion = devotional.getVersions().at(-1)
    await this.deliveryLogRepository.upsert(
      DevotionalDeliveryLog.create({
        devotionalId: devotional.getDevotionalId(),
        churchId: devotional.getChurchId(),
        devotionalWeeklyPlanId: devotional.getDevotionalWeeklyPlanId(),
        weekStartDate: devotional.getWeekStartDate(),
        scheduleDate: devotional.getScheduleDate(),
        scheduledAt: devotional.getScheduledAt(),
        attemptedAt: new Date(),
        audience: snapshot.audience,
        themeWeek: snapshot.themeWeek,
        versionNumber:
          latestVersion?.versionNumber ?? devotional.getLatestVersionNumber(),
        channels: {
          pushEnabled: snapshot.channels.pushEnabled,
          whatsappEnabled: snapshot.channels.whatsappEnabled,
        },
        results: {
          push: pushResult,
          whatsapp: whatsappResult,
          overall,
        },
        errors,
        contentSnapshot: {
          title: content.title,
          devotional: content.devotional,
          pushTitle: content.pushTitle,
          pushBody: content.pushBody,
        },
      })
    )
  }

  private resolveOverallStatus(
    push: DevotionalChannelResult,
    whatsapp: DevotionalChannelResult
  ): "sent" | "partial" | "error" {
    const enabled = [push, whatsapp].filter(
      (result) => result !== DevotionalChannelResult.NOT_ENABLED
    )

    if (!enabled.length) {
      return "error"
    }

    const sent = enabled.filter(
      (result) => result === DevotionalChannelResult.SENT
    ).length

    if (sent === enabled.length) {
      return "sent"
    }
    if (sent > 0) {
      return "partial"
    }
    return "error"
  }

  private async sendWhatsappToAudience(devotional: Devotional) {
    const members = await this.resolveAudienceMembers(
      devotional.getChurchId(),
      devotional.getPlanSnapshot().audience
    )

    const content = devotional.getContent()!
    const messageBody = [
      `*${content.title}*`,
      "",
      content.devotional,
      "",
      ...content.scriptures.map(
        (scripture) => `_${scripture.reference}: ${scripture.quote}_`
      ),
    ]
      .join("\n")
      .trim()

    let sent = 0
    let failed = 0

    for (const member of members) {
      const settings = member.getSettings()
      const phone = String(member.getPhone() ?? "").replace(/[^\d]/g, "")

      if (!settings?.whatsappOptIn || phone.length < 10) {
        continue
      }

      try {
        await new SendWhatsappTextMessage(this.churchRepository).execute({
          churchId: devotional.getChurchId(),
          to: phone,
          body: messageBody,
          previewUrl: false,
        })
        sent++
      } catch {
        failed++
      }
    }

    return { sent, failed }
  }

  private async resolveAudienceMembers(
    churchId: string,
    audience: DevotionalAudience
  ) {
    this.logger.info(`Resolving audience`)
    const members = await this.memberRepository.all(churchId, { status: "APPROVED" })

    if (audience === DevotionalAudience.ALL) {
      return members
    }

    if (audience === DevotionalAudience.YOUTH) {
      return members.filter((member) => {
        const age = this.ageFromBirthdate(member.getBirthdate())
        return age >= 13 && age <= 25
      })
    }

    if (audience === DevotionalAudience.KIDS) {
      return members.filter(
        (member) => this.ageFromBirthdate(member.getBirthdate()) <= 12
      )
    }

    // Gender is not explicitly modeled in current Member aggregate.
    // Until that profile data is available, fallback to all approved members.
    return members
  }

  private ageFromBirthdate(date: Date): number {
    const now = new Date()
    let age = now.getFullYear() - date.getFullYear()
    const monthDiff = now.getMonth() - date.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
      age--
    }

    return Math.max(age, 0)
  }

  private buildDevotionalDeepLink(devotionalId: string): string {
    return `/member/devotional/${encodeURIComponent(devotionalId)}`
  }
}
