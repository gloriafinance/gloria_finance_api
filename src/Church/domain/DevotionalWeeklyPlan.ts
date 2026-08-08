import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { IdentifyEntity } from "@/Shared/adapter"
import { DateBR } from "@/Shared/helpers"
import {
  DevotionalAudience,
  type DevotionalDayConfig,
  DevotionalDayOfWeek,
  type DevotionalPlanChannels,
  DevotionalPlanException,
  DevotionalPlanMode,
  DevotionalTone,
  type DevotionalWeeklyPlanPrimitives,
} from "@/Church/domain"

export class DevotionalWeeklyPlan extends AggregateRoot {
  private id?: string
  private devotionalWeeklyPlanId: string
  private churchId: string
  private weekStartDate: string
  private isEnabled: boolean
  private themeWeek: string
  private daysOfWeek: DevotionalDayOfWeek[]
  private sendTime: string
  private timezone: string
  private audience: DevotionalAudience
  private channels: DevotionalPlanChannels
  private mode: DevotionalPlanMode
  private dayConfigs: DevotionalDayConfig[]
  private configuredByUserId: string
  private updatedByUserId?: string
  private createdAt: Date
  private updatedAt: Date
  private lastSavedAt: Date

  static create(params: {
    churchId: string
    weekStartDate: string
    isEnabled: boolean
    themeWeek: string
    daysOfWeek: DevotionalDayOfWeek[]
    sendTime: string
    timezone: string
    audience: DevotionalAudience
    channels: DevotionalPlanChannels
    mode: DevotionalPlanMode
    dayConfigs: DevotionalDayConfig[]
    currentUserId: string
  }): DevotionalWeeklyPlan {
    const plan = new DevotionalWeeklyPlan()
    const now = DateBR()

    plan.devotionalWeeklyPlanId = IdentifyEntity.get("devotional_plan")
    plan.churchId = params.churchId
    plan.weekStartDate = params.weekStartDate
    plan.configuredByUserId = params.currentUserId
    plan.createdAt = now

    plan.applyConfiguration({
      isEnabled: params.isEnabled,
      themeWeek: params.themeWeek,
      daysOfWeek: params.daysOfWeek,
      sendTime: params.sendTime,
      timezone: params.timezone,
      audience: params.audience,
      channels: params.channels,
      mode: params.mode,
      dayConfigs: params.dayConfigs,
      currentUserId: params.currentUserId,
    })

    return plan
  }

  static fromPrimitives(payload: any): DevotionalWeeklyPlan {
    const plan = new DevotionalWeeklyPlan()
    plan.id = payload.id
    plan.devotionalWeeklyPlanId = payload.devotionalWeeklyPlanId
    plan.churchId = payload.churchId
    plan.weekStartDate = payload.weekStartDate
    plan.isEnabled = Boolean(payload.isEnabled)
    plan.themeWeek = String(payload.themeWeek ?? "")
    plan.daysOfWeek = DevotionalWeeklyPlan.normalizeDays(payload.daysOfWeek)
    plan.sendTime = String(payload.sendTime ?? "")
    plan.timezone = String(payload.timezone ?? "America/Sao_Paulo")
    plan.audience = payload.audience
    plan.channels = DevotionalWeeklyPlan.normalizeChannels(payload.channels)
    plan.mode = payload.mode
    plan.dayConfigs = DevotionalWeeklyPlan.normalizeDayConfigs(
      payload.dayConfigs
    )
    plan.configuredByUserId = String(payload.configuredByUserId ?? "")
    plan.updatedByUserId = payload.updatedByUserId
      ? String(payload.updatedByUserId)
      : undefined
    plan.createdAt = payload.createdAt ? new Date(payload.createdAt) : DateBR()
    plan.updatedAt = payload.updatedAt ? new Date(payload.updatedAt) : DateBR()
    plan.lastSavedAt = payload.lastSavedAt
      ? new Date(payload.lastSavedAt)
      : DateBR()

    return plan
  }

  private static normalizeChannels(input: any): DevotionalPlanChannels {
    return {
      pushEnabled: Boolean(input?.pushEnabled ?? true),
      whatsappEnabled: Boolean(input?.whatsappEnabled ?? false),
    }
  }

  private static normalizeDays(input: unknown): DevotionalDayOfWeek[] {
    const list = Array.isArray(input) ? input : []
    const unique = new Set<DevotionalDayOfWeek>()

    for (const raw of list) {
      const value = String(raw ?? "")
        .trim()
        .toUpperCase() as DevotionalDayOfWeek
      if (!Object.values(DevotionalDayOfWeek).includes(value)) {
        continue
      }
      unique.add(value)
    }

    return Array.from(unique)
  }

  private static normalizeDayConfigs(input: unknown): DevotionalDayConfig[] {
    const list = Array.isArray(input) ? input : []
    return list
      .map((item) => {
        const dayOfWeek = String(item?.dayOfWeek ?? "")
          .trim()
          .toUpperCase() as DevotionalDayOfWeek
        const tone = String(item?.tone ?? "").trim() as DevotionalTone
        return {
          dayOfWeek,
          titleHint: String(item?.titleHint ?? "").trim(),
          biblicalContext: String(item?.biblicalContext ?? "").trim(),
          tone,
        }
      })
      .filter((item) =>
        Object.values(DevotionalDayOfWeek).includes(item.dayOfWeek)
      )
  }

  private static isValidHHmm(value: string): boolean {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
  }

  applyConfiguration(params: {
    isEnabled: boolean
    themeWeek: string
    daysOfWeek: DevotionalDayOfWeek[]
    sendTime: string
    timezone: string
    audience: DevotionalAudience
    channels: DevotionalPlanChannels
    mode: DevotionalPlanMode
    dayConfigs: DevotionalDayConfig[]
    currentUserId: string
  }) {
    const now = DateBR()
    this.isEnabled = params.isEnabled

    const normalizedTheme = String(params.themeWeek ?? "").trim()
    const normalizedDays = DevotionalWeeklyPlan.normalizeDays(params.daysOfWeek)
    const normalizedSendTime = String(params.sendTime ?? "").trim()
    const normalizedTimezone = String(params.timezone ?? "").trim()
    const normalizedChannels = DevotionalWeeklyPlan.normalizeChannels(
      params.channels
    )
    const normalizedDayConfigs = DevotionalWeeklyPlan.normalizeDayConfigs(
      params.dayConfigs
    )

    if (params.isEnabled) {
      if (!normalizedTheme) {
        throw new DevotionalPlanException(
          "Theme is required when devotional plan is enabled"
        )
      }
      if (!normalizedDays.length) {
        throw new DevotionalPlanException(
          "At least one week day is required when devotional plan is enabled"
        )
      }
      if (!DevotionalWeeklyPlan.isValidHHmm(normalizedSendTime)) {
        throw new DevotionalPlanException(
          "Send time is required in HH:mm format"
        )
      }
      if (!normalizedTimezone) {
        throw new DevotionalPlanException(
          "Timezone is required when devotional plan is enabled"
        )
      }
      if (!params.audience) {
        throw new DevotionalPlanException(
          "Audience is required when devotional plan is enabled"
        )
      }
      if (!params.mode) {
        throw new DevotionalPlanException(
          "Mode is required when devotional plan is enabled"
        )
      }
      if (
        !normalizedChannels.pushEnabled &&
        !normalizedChannels.whatsappEnabled
      ) {
        throw new DevotionalPlanException(
          "At least one channel must be enabled"
        )
      }
      this.validateDayConfigs(normalizedDays, normalizedDayConfigs)
    }

    this.themeWeek = normalizedTheme
    this.daysOfWeek = normalizedDays
    this.sendTime = normalizedSendTime
    this.timezone = normalizedTimezone || "America/Sao_Paulo"
    this.audience = params.audience ?? DevotionalAudience.ALL
    this.channels = normalizedChannels
    this.mode = params.mode ?? DevotionalPlanMode.REVIEW
    this.dayConfigs = normalizedDayConfigs
    this.updatedByUserId = params.currentUserId
    this.updatedAt = now
    this.lastSavedAt = now
  }

  getId(): string | undefined {
    return this.id
  }

  getDevotionalWeeklyPlanId(): string {
    return this.devotionalWeeklyPlanId
  }

  getChurchId(): string {
    return this.churchId
  }

  getWeekStartDate(): string {
    return this.weekStartDate
  }

  getIsEnabled(): boolean {
    return this.isEnabled
  }

  getThemeWeek(): string {
    return this.themeWeek
  }

  getDaysOfWeek(): DevotionalDayOfWeek[] {
    return [...this.daysOfWeek]
  }

  getSendTime(): string {
    return this.sendTime
  }

  getTimezone(): string {
    return this.timezone
  }

  getAudience(): DevotionalAudience {
    return this.audience
  }

  getChannels(): DevotionalPlanChannels {
    return { ...this.channels }
  }

  getMode(): DevotionalPlanMode {
    return this.mode
  }

  getDayConfigs(): DevotionalDayConfig[] {
    return this.dayConfigs.map((cfg) => ({ ...cfg }))
  }

  getDayConfig(day: DevotionalDayOfWeek): DevotionalDayConfig | undefined {
    return this.dayConfigs.find((config) => config.dayOfWeek === day)
  }

  toPrimitives(): DevotionalWeeklyPlanPrimitives {
    return {
      devotionalWeeklyPlanId: this.devotionalWeeklyPlanId,
      churchId: this.churchId,
      weekStartDate: this.weekStartDate,
      isEnabled: this.isEnabled,
      themeWeek: this.themeWeek,
      daysOfWeek: this.daysOfWeek,
      sendTime: this.sendTime,
      timezone: this.timezone,
      audience: this.audience,
      channels: this.channels,
      mode: this.mode,
      dayConfigs: this.dayConfigs,
      configuredByUserId: this.configuredByUserId,
      updatedByUserId: this.updatedByUserId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastSavedAt: this.lastSavedAt,
    }
  }

  private validateDayConfigs(
    selectedDays: DevotionalDayOfWeek[],
    dayConfigs: DevotionalDayConfig[]
  ) {
    const map = new Map(dayConfigs.map((cfg) => [cfg.dayOfWeek, cfg]))
    for (const day of selectedDays) {
      const config = map.get(day)
      if (!config) {
        throw new DevotionalPlanException(
          `Missing day configuration for ${day}`
        )
      }
      if (!config.titleHint?.trim()) {
        throw new DevotionalPlanException(`Title hint is required for ${day}`)
      }
      if (config.titleHint.trim().length > 120) {
        throw new DevotionalPlanException(
          `Title hint for ${day} must be at most 120 characters`
        )
      }
      if (!config.biblicalContext?.trim()) {
        throw new DevotionalPlanException(
          `Biblical context is required for ${day}`
        )
      }
      if (config.biblicalContext.trim().length > 400) {
        throw new DevotionalPlanException(
          `Biblical context for ${day} must be at most 400 characters`
        )
      }
      if (!Object.values(DevotionalTone).includes(config.tone)) {
        throw new DevotionalPlanException(`Tone is invalid for ${day}`)
      }
    }
  }
}
