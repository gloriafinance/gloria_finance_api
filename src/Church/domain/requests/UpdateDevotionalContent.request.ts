import type { DevotionalScriptureItem } from "@/Church/domain"

export type UpdateDevotionalContentRequest = {
  churchId: string
  devotionalId: string
  title: string
  devotional: string
  scriptures: DevotionalScriptureItem[]
  pushTitle: string
  pushBody: string
  currentUserId: string
}
