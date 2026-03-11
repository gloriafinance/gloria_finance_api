import type { DevotionalAudience, DevotionalStatus } from "@/Church/domain"

export type ListDevotionalAgendaRequest = {
  churchId: string
  weekStartDate: string
  status?: DevotionalStatus
  audience?: DevotionalAudience
  channel?: "push" | "whatsapp"
}
