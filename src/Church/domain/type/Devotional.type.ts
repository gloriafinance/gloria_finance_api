import type {
  DevotionalAudience,
  DevotionalChannelResult,
  DevotionalDayOfWeek,
  DevotionalPlanChannels,
  DevotionalPlanMode,
  DevotionalStatus,
  DevotionalTone,
} from "@/Church/domain"

export type DevotionalScriptureItem = {
  reference: string
  quote: string
}

export type DevotionalGeneratedContent = {
  title: string
  devotional: string
  scriptures: DevotionalScriptureItem[]
  pushTitle: string
  pushBody: string
}

export type DevotionalVersion = {
  versionNumber: number
  content: DevotionalGeneratedContent
  createdAt: Date
  createdByUserId?: string
  reason: "generated" | "regenerated" | "edited"
}

export type DevotionalPlanSnapshot = {
  themeWeek: string
  audience: DevotionalAudience
  mode: DevotionalPlanMode
  timezone: string
  sendTime: string
  channels: DevotionalPlanChannels
  dayConfig: {
    dayOfWeek: DevotionalDayOfWeek
    titleHint: string
    biblicalContext: string
    tone: DevotionalTone
  }
}

export type DevotionalPrimitives = {
  devotionalId: string
  churchId: string
  devotionalWeeklyPlanId: string
  weekStartDate: string
  scheduleDate: string
  dayOfWeek: DevotionalDayOfWeek
  scheduledAt: Date
  timezone: string
  status: DevotionalStatus
  planSnapshot: DevotionalPlanSnapshot
  content?: DevotionalGeneratedContent
  versions: DevotionalVersion[]
  generatedAt?: Date
  approvedAt?: Date
  approvedByUserId?: string
  lastEditedAt?: Date
  lastEditedByUserId?: string
  sendingStartedAt?: Date
  sentAt?: Date
  failedAt?: Date
  failureReason?: string
  pushResult: DevotionalChannelResult
  whatsappResult: DevotionalChannelResult
  idempotencyBaseKey: string
  createdAt: Date
  updatedAt: Date
}
