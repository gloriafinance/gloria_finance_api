import type { DevotionalAudience } from "@/Church/domain"

export type ListDevotionalHistoryRequest = {
  churchId: string
  fromDate?: string
  toDate?: string
  audience?: DevotionalAudience
  channel?: "push" | "whatsapp"
  overall?: "sent" | "partial" | "error"
  query?: string
}
