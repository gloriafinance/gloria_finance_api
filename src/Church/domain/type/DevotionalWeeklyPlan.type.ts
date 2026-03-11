import type {
  DevotionalAudience,
  DevotionalDayOfWeek,
  DevotionalPlanMode,
  DevotionalTone,
} from "@/Church/domain"

export type DevotionalPlanChannels = {
  pushEnabled: boolean
  whatsappEnabled: boolean
}

export type DevotionalDayConfig = {
  dayOfWeek: DevotionalDayOfWeek
  titleHint: string
  biblicalContext: string
  tone: DevotionalTone
}

export type DevotionalWeeklyPlanPrimitives = {
  devotionalWeeklyPlanId: string
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
  configuredByUserId: string
  updatedByUserId?: string
  createdAt: Date
  updatedAt: Date
  lastSavedAt: Date
}
