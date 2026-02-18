import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { IdentifyEntity } from "@/Shared/adapter"
import { DateBR } from "@/Shared/helpers"
import {
  DevotionalChannelResult,
  type DevotionalDayOfWeek,
  type DevotionalGeneratedContent,
  DevotionalPlanException,
  DevotionalPlanMode,
  type DevotionalPlanSnapshot,
  type DevotionalPrimitives,
  DevotionalStatus,
  type DevotionalVersion,
} from "@/Church/domain"

export class Devotional extends AggregateRoot {
  private id?: string
  private devotionalId: string
  private churchId: string
  private devotionalWeeklyPlanId: string
  private weekStartDate: string
  private scheduleDate: string
  private dayOfWeek: DevotionalDayOfWeek
  private scheduledAt: Date
  private timezone: string
  private status: DevotionalStatus
  private planSnapshot: DevotionalPlanSnapshot
  private content?: DevotionalGeneratedContent
  private versions: DevotionalVersion[]
  private generatedAt?: Date
  private approvedAt?: Date
  private approvedByUserId?: string
  private lastEditedAt?: Date
  private lastEditedByUserId?: string
  private sendingStartedAt?: Date
  private sentAt?: Date
  private failedAt?: Date
  private failureReason?: string
  private pushResult: DevotionalChannelResult
  private whatsappResult: DevotionalChannelResult
  private idempotencyBaseKey: string
  private createdAt: Date
  private updatedAt: Date

  static createPending(params: {
    churchId: string
    devotionalWeeklyPlanId: string
    weekStartDate: string
    scheduleDate: string
    dayOfWeek: DevotionalDayOfWeek
    scheduledAt: Date
    timezone: string
    planSnapshot: DevotionalPlanSnapshot
  }): Devotional {
    const devotional = new Devotional()
    const now = DateBR()

    devotional.devotionalId = IdentifyEntity.get("devotional")
    devotional.churchId = params.churchId
    devotional.devotionalWeeklyPlanId = params.devotionalWeeklyPlanId
    devotional.weekStartDate = params.weekStartDate
    devotional.scheduleDate = params.scheduleDate
    devotional.dayOfWeek = params.dayOfWeek
    devotional.scheduledAt = params.scheduledAt
    devotional.timezone = params.timezone
    devotional.planSnapshot = params.planSnapshot
    devotional.status = DevotionalStatus.PENDING
    devotional.versions = []
    devotional.pushResult = params.planSnapshot.channels.pushEnabled
      ? DevotionalChannelResult.PENDING
      : DevotionalChannelResult.NOT_ENABLED
    devotional.whatsappResult = params.planSnapshot.channels.whatsappEnabled
      ? DevotionalChannelResult.PENDING
      : DevotionalChannelResult.NOT_ENABLED
    devotional.idempotencyBaseKey = Devotional.buildIdempotencyBaseKey(
      params.churchId,
      params.devotionalWeeklyPlanId,
      params.scheduleDate,
      params.scheduledAt
    )
    devotional.createdAt = now
    devotional.updatedAt = now

    return devotional
  }

  static override fromPrimitives(payload: any): Devotional {
    const devotional = new Devotional()
    devotional.id = payload.id
    devotional.devotionalId = payload.devotionalId
    devotional.churchId = payload.churchId
    devotional.devotionalWeeklyPlanId = payload.devotionalWeeklyPlanId
    devotional.weekStartDate = payload.weekStartDate
    devotional.scheduleDate = payload.scheduleDate
    devotional.dayOfWeek = payload.dayOfWeek
    devotional.scheduledAt = new Date(payload.scheduledAt)
    devotional.timezone = payload.timezone
    devotional.status = payload.status
    devotional.planSnapshot = payload.planSnapshot
    devotional.content = payload.content
      ? Devotional.normalizeContent(payload.content)
      : undefined
    devotional.versions = Array.isArray(payload.versions)
      ? payload.versions.map((version: any) => ({
          versionNumber: Number(version.versionNumber),
          content: Devotional.normalizeContent(version.content),
          createdAt: new Date(version.createdAt),
          createdByUserId: version.createdByUserId,
          reason: version.reason,
        }))
      : []
    devotional.generatedAt = payload.generatedAt
      ? new Date(payload.generatedAt)
      : undefined
    devotional.approvedAt = payload.approvedAt
      ? new Date(payload.approvedAt)
      : undefined
    devotional.approvedByUserId = payload.approvedByUserId
    devotional.lastEditedAt = payload.lastEditedAt
      ? new Date(payload.lastEditedAt)
      : undefined
    devotional.lastEditedByUserId = payload.lastEditedByUserId
    devotional.sendingStartedAt = payload.sendingStartedAt
      ? new Date(payload.sendingStartedAt)
      : undefined
    devotional.sentAt = payload.sentAt ? new Date(payload.sentAt) : undefined
    devotional.failedAt = payload.failedAt
      ? new Date(payload.failedAt)
      : undefined
    devotional.failureReason = payload.failureReason
    devotional.pushResult = payload.pushResult
    devotional.whatsappResult = payload.whatsappResult
    devotional.idempotencyBaseKey = payload.idempotencyBaseKey
    devotional.createdAt = payload.createdAt
      ? new Date(payload.createdAt)
      : DateBR()
    devotional.updatedAt = payload.updatedAt
      ? new Date(payload.updatedAt)
      : DateBR()

    return devotional
  }

  static normalizeContent(payload: any): DevotionalGeneratedContent {
    const scriptures = Array.isArray(payload?.scriptures)
      ? payload.scriptures
      : []

    const normalized: DevotionalGeneratedContent = {
      title: String(payload?.title ?? "").trim(),
      devotional: String(payload?.devotional ?? "").trim(),
      scriptures: scriptures
        .map((scripture: any) => ({
          reference: String(scripture?.reference ?? "").trim(),
          quote: String(scripture?.quote ?? "").trim(),
        }))
        .filter((scripture: any) => scripture.reference && scripture.quote),
      pushTitle: String(payload?.pushTitle ?? payload?.push_title ?? "").trim(),
      pushBody: String(payload?.pushBody ?? payload?.push_body ?? "").trim(),
    }

    if (!normalized.title || !normalized.devotional) {
      throw new DevotionalPlanException("Devotional content is incomplete")
    }
    if (!normalized.pushTitle || !normalized.pushBody) {
      throw new DevotionalPlanException("Push content is incomplete")
    }
    if (!normalized.scriptures.length) {
      throw new DevotionalPlanException("At least one scripture is required")
    }

    return normalized
  }

  private static buildIdempotencyBaseKey(
    churchId: string,
    devotionalWeeklyPlanId: string,
    scheduleDate: string,
    scheduledAt: Date
  ): string {
    return `${churchId}:${devotionalWeeklyPlanId}:${scheduleDate}:${scheduledAt.toISOString()}`
  }

  replacePlanSnapshot(snapshot: DevotionalPlanSnapshot) {
    this.planSnapshot = snapshot
    if (!snapshot.channels.pushEnabled) {
      this.pushResult = DevotionalChannelResult.NOT_ENABLED
    }
    if (!snapshot.channels.whatsappEnabled) {
      this.whatsappResult = DevotionalChannelResult.NOT_ENABLED
    }
    this.touch()
  }

  reschedule(params: {
    scheduleDate: string
    scheduledAt: Date
    timezone: string
    planSnapshot: DevotionalPlanSnapshot
  }) {
    if (this.status === DevotionalStatus.SENT) {
      return
    }

    this.scheduleDate = params.scheduleDate
    this.scheduledAt = params.scheduledAt
    this.timezone = params.timezone
    this.replacePlanSnapshot(params.planSnapshot)
    this.idempotencyBaseKey = Devotional.buildIdempotencyBaseKey(
      this.churchId,
      this.devotionalWeeklyPlanId,
      params.scheduleDate,
      params.scheduledAt
    )
    this.touch()
  }

  markGenerating() {
    if (this.status === DevotionalStatus.SENT) {
      throw new DevotionalPlanException(
        "Cannot regenerate devotional that was already sent"
      )
    }
    this.status = DevotionalStatus.GENERATING
    this.pushResult = this.planSnapshot.channels.pushEnabled
      ? DevotionalChannelResult.PENDING
      : DevotionalChannelResult.NOT_ENABLED
    this.whatsappResult = this.planSnapshot.channels.whatsappEnabled
      ? DevotionalChannelResult.PENDING
      : DevotionalChannelResult.NOT_ENABLED
    this.failedAt = undefined
    this.failureReason = undefined
    this.touch()
  }

  applyGeneratedContent(
    content: DevotionalGeneratedContent,
    createdByUserId?: string
  ) {
    this.content = Devotional.normalizeContent(content)
    this.generatedAt = DateBR()
    this.failedAt = undefined
    this.failureReason = undefined

    const version: DevotionalVersion = {
      versionNumber: this.versions.length + 1,
      content: this.content,
      createdAt: DateBR(),
      createdByUserId,
      reason: this.versions.length === 0 ? "generated" : "regenerated",
    }
    this.versions.push(version)

    this.status =
      this.planSnapshot.mode === DevotionalPlanMode.AUTOMATIC
        ? DevotionalStatus.APPROVED
        : DevotionalStatus.IN_REVIEW

    this.touch()
  }

  editContent(content: DevotionalGeneratedContent, userId: string) {
    if (this.status === DevotionalStatus.SENT) {
      throw new DevotionalPlanException(
        "Cannot edit devotional after it was sent"
      )
    }
    this.content = Devotional.normalizeContent(content)

    const version: DevotionalVersion = {
      versionNumber: this.versions.length + 1,
      content: this.content,
      createdAt: DateBR(),
      createdByUserId: userId,
      reason: "edited",
    }
    this.versions.push(version)

    this.lastEditedAt = DateBR()
    this.lastEditedByUserId = userId
    this.status = DevotionalStatus.IN_REVIEW
    this.touch()
  }

  approve(userId: string) {
    if (this.status === DevotionalStatus.SENT) {
      throw new DevotionalPlanException("Devotional is already sent")
    }
    if (!this.content) {
      throw new DevotionalPlanException("Devotional content is not available")
    }
    this.status = DevotionalStatus.APPROVED
    this.approvedAt = DateBR()
    this.approvedByUserId = userId
    this.touch()
  }

  markSending() {
    if (!this.content) {
      throw new DevotionalPlanException(
        "Cannot send devotional without content"
      )
    }
    this.status = DevotionalStatus.SENDING
    this.sendingStartedAt = DateBR()
    this.failedAt = undefined
    this.failureReason = undefined
    this.touch()
  }

  markSent(params: {
    push: DevotionalChannelResult
    whatsapp: DevotionalChannelResult
  }) {
    this.pushResult = params.push
    this.whatsappResult = params.whatsapp
    this.sentAt = DateBR()
    this.status = DevotionalStatus.SENT
    this.touch()
  }

  markFailed(
    reason: string,
    params?: {
      push?: DevotionalChannelResult
      whatsapp?: DevotionalChannelResult
    }
  ) {
    this.failedAt = DateBR()
    this.failureReason = reason
    this.status = DevotionalStatus.FAILED
    if (params?.push) {
      this.pushResult = params.push
    }
    if (params?.whatsapp) {
      this.whatsappResult = params.whatsapp
    }
    this.touch()
  }

  getLatestVersionNumber(): number {
    if (!this.versions.length) {
      return 0
    }
    return this.versions[this.versions.length - 1].versionNumber
  }

  getId(): string | undefined {
    return this.id
  }

  getDevotionalId(): string {
    return this.devotionalId
  }

  getChurchId(): string {
    return this.churchId
  }

  getDevotionalWeeklyPlanId(): string {
    return this.devotionalWeeklyPlanId
  }

  getWeekStartDate(): string {
    return this.weekStartDate
  }

  getScheduleDate(): string {
    return this.scheduleDate
  }

  getDayOfWeek() {
    return this.dayOfWeek
  }

  getScheduledAt(): Date {
    return this.scheduledAt
  }

  getTimezone(): string {
    return this.timezone
  }

  getStatus(): DevotionalStatus {
    return this.status
  }

  getPlanSnapshot(): DevotionalPlanSnapshot {
    return {
      ...this.planSnapshot,
      channels: { ...this.planSnapshot.channels },
      dayConfig: { ...this.planSnapshot.dayConfig },
    }
  }

  getContent(): DevotionalGeneratedContent | undefined {
    return this.content ? { ...this.content } : undefined
  }

  getVersions(): DevotionalVersion[] {
    return this.versions.map((version) => ({
      ...version,
      content: {
        ...version.content,
        scriptures: [...version.content.scriptures],
      },
    }))
  }

  getPushResult(): DevotionalChannelResult {
    return this.pushResult
  }

  getWhatsappResult(): DevotionalChannelResult {
    return this.whatsappResult
  }

  getIdempotencyBaseKey(): string {
    return this.idempotencyBaseKey
  }

  wasPushDelivered(): boolean {
    return this.pushResult === DevotionalChannelResult.SENT
  }

  wasWhatsappDelivered(): boolean {
    return this.whatsappResult === DevotionalChannelResult.SENT
  }

  isPushEnabled(): boolean {
    return this.planSnapshot.channels.pushEnabled
  }

  isWhatsappEnabled(): boolean {
    return this.planSnapshot.channels.whatsappEnabled
  }

  toPrimitives(): DevotionalPrimitives {
    return {
      devotionalId: this.devotionalId,
      churchId: this.churchId,
      devotionalWeeklyPlanId: this.devotionalWeeklyPlanId,
      weekStartDate: this.weekStartDate,
      scheduleDate: this.scheduleDate,
      dayOfWeek: this.dayOfWeek,
      scheduledAt: this.scheduledAt,
      timezone: this.timezone,
      status: this.status,
      planSnapshot: this.planSnapshot,
      content: this.content,
      versions: this.versions,
      generatedAt: this.generatedAt,
      approvedAt: this.approvedAt,
      approvedByUserId: this.approvedByUserId,
      lastEditedAt: this.lastEditedAt,
      lastEditedByUserId: this.lastEditedByUserId,
      sendingStartedAt: this.sendingStartedAt,
      sentAt: this.sentAt,
      failedAt: this.failedAt,
      failureReason: this.failureReason,
      pushResult: this.pushResult,
      whatsappResult: this.whatsappResult,
      idempotencyBaseKey: this.idempotencyBaseKey,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }

  private touch() {
    this.updatedAt = DateBR()
  }
}
