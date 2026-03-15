import {
  Devotional,
  DevotionalAudience,
  type DevotionalDayConfig,
  type DevotionalDayOfWeek,
  DevotionalPlanException,
  DevotionalPlanMode,
  DevotionalWeeklyPlan,
  type IDevotionalDateService,
  type IDevotionalRepository,
  type IDevotionalWeeklyPlanRepository,
  type UpsertDevotionalWeeklyPlanRequest,
} from "@/Church/domain"

export class DevotionalPlanService {
  constructor(
    private readonly planRepository: IDevotionalWeeklyPlanRepository,
    private readonly devotionalRepository: IDevotionalRepository,
    private readonly devotionalDateService: IDevotionalDateService
  ) {}

  async upsertWeeklyPlan(request: UpsertDevotionalWeeklyPlanRequest): Promise<{
    plan: DevotionalWeeklyPlan
    warning?: string
  }> {
    const { church } = request

    const weekStartDate = String(request.weekStartDate ?? "").trim()
    if (!weekStartDate) {
      throw new DevotionalPlanException("weekStartDate is required")
    }

    const existingPlan = await this.planRepository.findByChurchAndWeek(
      church.getChurchId(),
      weekStartDate
    )

    const timezone = church.getTimezone()

    const currentWeekStartDate =
      this.devotionalDateService.getWeekStartDateForTimezone(timezone)
    const nextWeekStartDate =
      this.devotionalDateService.getNextWeekStartDateForTimezone(timezone)

    if (![currentWeekStartDate, nextWeekStartDate].includes(weekStartDate)) {
      throw new DevotionalPlanException(
        `Only current or next week can be configured. Allowed weekStartDate values: ${currentWeekStartDate}, ${nextWeekStartDate}`
      )
    }

    const whatsappConnected = church.isWhatsappConnected()
    const pushEnabled = Boolean(request.channels?.pushEnabled ?? true)
    const requestedWhatsapp = Boolean(
      request.channels?.whatsappEnabled ?? false
    )
    const whatsappEnabled = whatsappConnected ? requestedWhatsapp : false

    const payload = {
      isEnabled: Boolean(request.isEnabled),
      themeWeek: String(request.themeWeek ?? ""),
      daysOfWeek: request.daysOfWeek ?? [],
      sendTime: String(request.sendTime ?? ""),
      timezone,
      audience: request.audience ?? DevotionalAudience.ALL,
      channels: {
        pushEnabled,
        whatsappEnabled,
      },
      mode:
        request.mode ??
        (request.requiresPastorReview
          ? DevotionalPlanMode.REVIEW
          : DevotionalPlanMode.AUTOMATIC),
      dayConfigs: request.dayConfigs ?? [],
      currentUserId: request.currentUserId,
    }

    const plan =
      existingPlan ??
      DevotionalWeeklyPlan.create({
        churchId: church.getChurchId(),
        weekStartDate,
        isEnabled: payload.isEnabled,
        themeWeek: payload.themeWeek,
        daysOfWeek: payload.daysOfWeek,
        sendTime: payload.sendTime,
        timezone: payload.timezone,
        audience: payload.audience,
        channels: payload.channels,
        mode: payload.mode,
        dayConfigs: payload.dayConfigs,
        currentUserId: payload.currentUserId,
      })

    if (existingPlan) {
      const removedDays = this.getRemovedDays(existingPlan, payload.daysOfWeek)
      plan.applyConfiguration(payload)
      if (removedDays.length) {
        await this.devotionalRepository.deleteByChurchWeekAndDays(
          church.getChurchId(),
          weekStartDate,
          removedDays
        )
      }
    }

    await this.planRepository.upsert(plan)

    await this.syncDevotionalsForPlan(plan)

    const warning =
      requestedWhatsapp && !whatsappConnected
        ? "WhatsApp disconnected; devotional flow will use push only"
        : undefined

    return { plan, warning }
  }

  async getWeeklyPlan(churchId: string, weekStartDate: string) {
    return this.planRepository.findByChurchAndWeek(churchId, weekStartDate)
  }

  async syncDevotionalsForPlan(plan: DevotionalWeeklyPlan): Promise<void> {
    if (!plan.getIsEnabled()) {
      return
    }

    const devotionals = await this.devotionalRepository.findByChurchAndWeek(
      plan.getChurchId(),
      plan.getWeekStartDate()
    )

    const byDay = new Map<DevotionalDayOfWeek, Devotional>()
    for (const devotional of devotionals) {
      byDay.set(devotional.getDayOfWeek(), devotional)
    }

    for (const dayOfWeek of plan.getDaysOfWeek()) {
      const dayConfig = plan.getDayConfig(dayOfWeek)
      if (!dayConfig) {
        continue
      }

      const scheduleDate = this.devotionalDateService.scheduleDateForDay(
        plan.getWeekStartDate(),
        dayOfWeek,
        plan.getTimezone()
      )
      const scheduledAt = this.devotionalDateService.scheduledAtFromDateAndTime(
        scheduleDate,
        plan.getSendTime(),
        plan.getTimezone()
      )
      const snapshot = this.buildPlanSnapshot(plan, dayConfig)

      const current = byDay.get(dayOfWeek)
      if (!current) {
        const devotional = Devotional.createPending({
          churchId: plan.getChurchId(),
          devotionalWeeklyPlanId: plan.getDevotionalWeeklyPlanId(),
          weekStartDate: plan.getWeekStartDate(),
          scheduleDate,
          dayOfWeek,
          scheduledAt,
          timezone: plan.getTimezone(),
          planSnapshot: snapshot,
        })
        await this.devotionalRepository.upsert(devotional)
        continue
      }

      current.reschedule({
        scheduleDate,
        scheduledAt,
        timezone: plan.getTimezone(),
        planSnapshot: snapshot,
      })
      await this.devotionalRepository.upsert(current)
    }
  }

  private buildPlanSnapshot(
    plan: DevotionalWeeklyPlan,
    dayConfig: DevotionalDayConfig
  ) {
    return {
      themeWeek: plan.getThemeWeek(),
      audience: plan.getAudience(),
      mode: plan.getMode(),
      timezone: plan.getTimezone(),
      sendTime: plan.getSendTime(),
      channels: plan.getChannels(),
      dayConfig: {
        dayOfWeek: dayConfig.dayOfWeek,
        titleHint: dayConfig.titleHint,
        biblicalContext: dayConfig.biblicalContext,
        tone: dayConfig.tone,
      },
    }
  }

  private getRemovedDays(
    existingPlan: DevotionalWeeklyPlan | undefined,
    newDays: DevotionalDayOfWeek[]
  ): DevotionalDayOfWeek[] {
    if (!existingPlan) {
      return []
    }

    const incoming = new Set(newDays)
    return existingPlan
      .getDaysOfWeek()
      .filter((dayOfWeek) => !incoming.has(dayOfWeek))
  }
}
