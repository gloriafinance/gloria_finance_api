import {
  Church,
  type DevotionalAudience,
  type DevotionalDayConfig,
  type DevotionalDayOfWeek,
  type DevotionalPlanMode,
} from "@/Church/domain"

export type UpsertDevotionalWeeklyPlanRequest = {
  church: Church
  weekStartDate: string
  isEnabled: boolean
  themeWeek?: string
  daysOfWeek?: DevotionalDayOfWeek[]
  sendTime?: string
  timezone?: string
  audience?: DevotionalAudience
  requiresPastorReview?: boolean
  channels?: {
    pushEnabled?: boolean
    whatsappEnabled?: boolean
  }
  mode?: DevotionalPlanMode
  dayConfigs?: DevotionalDayConfig[]
  currentUserId: string
}
