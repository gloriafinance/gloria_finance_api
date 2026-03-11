import {
  DevotionalChannelResult,
  Devotional,
  DevotionalNotFound,
  DevotionalStatus,
  type IDevotionalDeliveryLogRepository,
  type IDevotionalRepository,
  type ListDevotionalAgendaRequest,
  type ListDevotionalHistoryRequest,
  type UpdateDevotionalContentRequest,
} from "@/Church/domain"

export class DevotionalQueriesService {
  constructor(
    private readonly devotionalRepository: IDevotionalRepository,
    private readonly deliveryLogRepository: IDevotionalDeliveryLogRepository
  ) {}

  async listAgenda(request: ListDevotionalAgendaRequest) {
    const devotionals = await this.devotionalRepository.findByChurchAndWeek(
      request.churchId,
      request.weekStartDate
    )

    const filtered = devotionals.filter((devotional) => {
      if (request.status && devotional.getStatus() !== request.status) {
        return false
      }
      if (
        request.audience &&
        devotional.getPlanSnapshot().audience !== request.audience
      ) {
        return false
      }
      if (request.channel === "push" && !devotional.isPushEnabled()) {
        return false
      }
      if (request.channel === "whatsapp" && !devotional.isWhatsappEnabled()) {
        return false
      }
      return true
    })

    const now = new Date()
    const nextSend = filtered
      .filter((item) =>
        [
          DevotionalStatus.PENDING,
          DevotionalStatus.GENERATING,
          DevotionalStatus.IN_REVIEW,
          DevotionalStatus.APPROVED,
        ].includes(item.getStatus())
      )
      .map((item) => item.getScheduledAt())
      .filter((date) => date.getTime() >= now.getTime())
      .sort((a, b) => a.getTime() - b.getTime())[0]

    const inReviewCount = filtered.filter(
      (item) => item.getStatus() === DevotionalStatus.IN_REVIEW
    ).length

    return {
      weekStartDate: request.weekStartDate,
      nextSendAt: nextSend?.toISOString(),
      inReviewCount,
      items: filtered.map((item) => this.mapDevotionalItem(item)),
    }
  }

  async getDevotionalById(churchId: string, devotionalId: string) {
    const devotional = await this.devotionalRepository.findByDevotionalId(
      churchId,
      devotionalId
    )

    if (!devotional) {
      throw new DevotionalNotFound()
    }

    return this.mapDevotionalDetail(devotional)
  }

  async editDevotionalContent(request: UpdateDevotionalContentRequest) {
    const devotional = await this.devotionalRepository.findByDevotionalId(
      request.churchId,
      request.devotionalId
    )

    if (!devotional) {
      throw new DevotionalNotFound()
    }

    devotional.editContent(
      {
        title: request.title,
        devotional: request.devotional,
        scriptures: request.scriptures,
        pushTitle: request.pushTitle,
        pushBody: request.pushBody,
      },
      request.currentUserId
    )

    await this.devotionalRepository.upsert(devotional)

    return this.mapDevotionalDetail(devotional)
  }

  async listHistory(request: ListDevotionalHistoryRequest) {
    const logs = await this.deliveryLogRepository.search(request)

    const total = logs.length
    const sent = logs.filter(
      (item) => item.getPayload().results.overall === "sent"
    ).length
    const partial = logs.filter(
      (item) => item.getPayload().results.overall === "partial"
    ).length
    const error = logs.filter(
      (item) => item.getPayload().results.overall === "error"
    ).length

    return {
      metrics: {
        total,
        sent,
        partial,
        error,
      },
      items: logs.map((item) => item.getPayload()),
    }
  }

  mapDevotionalDetail(devotional: Devotional) {
    return {
      ...this.mapDevotionalItem(devotional),
      planSnapshot: devotional.getPlanSnapshot(),
      content: devotional.getContent(),
      versions: devotional.getVersions(),
      idempotencyBaseKey: devotional.getIdempotencyBaseKey(),
    }
  }

  private mapDevotionalItem(devotional: Devotional) {
    const snapshot = devotional.getPlanSnapshot()
    const status = devotional.getStatus()

    const hasDeliveryAttempt = [
      DevotionalStatus.SENDING,
      DevotionalStatus.SENT,
      DevotionalStatus.FAILED,
    ].includes(status)

    const pushResult = snapshot.channels.pushEnabled
      ? hasDeliveryAttempt
        ? devotional.getPushResult()
        : DevotionalChannelResult.PENDING
      : DevotionalChannelResult.NOT_ENABLED
    const whatsappResult = snapshot.channels.whatsappEnabled
      ? hasDeliveryAttempt
        ? devotional.getWhatsappResult()
        : DevotionalChannelResult.PENDING
      : DevotionalChannelResult.NOT_ENABLED

    return {
      devotionalId: devotional.getDevotionalId(),
      weekStartDate: devotional.getWeekStartDate(),
      scheduleDate: devotional.getScheduleDate(),
      dayOfWeek: devotional.getDayOfWeek(),
      scheduledAt: devotional.getScheduledAt(),
      status,
      audience: snapshot.audience,
      mode: snapshot.mode,
      channels: snapshot.channels,
      pushResult,
      whatsappResult,
      title: devotional.getContent()?.title,
      isLate:
        status === DevotionalStatus.IN_REVIEW &&
        devotional.getScheduledAt().getTime() < Date.now(),
    }
  }
}
