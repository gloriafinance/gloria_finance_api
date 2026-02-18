import type {
  DevotionalAudience,
  DevotionalChannelResult,
} from "@/Church/domain"

export type DevotionalDeliveryLogPrimitives = {
  devotionalDeliveryLogId: string
  devotionalId: string
  churchId: string
  devotionalWeeklyPlanId: string
  weekStartDate: string
  scheduleDate: string
  scheduledAt: Date
  attemptedAt: Date
  audience: DevotionalAudience
  themeWeek: string
  versionNumber: number
  channels: {
    pushEnabled: boolean
    whatsappEnabled: boolean
  }
  results: {
    push: DevotionalChannelResult
    whatsapp: DevotionalChannelResult
    overall: "sent" | "partial" | "error"
  }
  errors: string[]
  contentSnapshot: {
    title: string
    devotional: string
    pushTitle: string
    pushBody: string
  }
}
