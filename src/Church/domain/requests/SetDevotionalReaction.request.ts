import type { DevotionalReactionType } from "@/Church/domain"

export type SetDevotionalReactionRequest = {
  churchId: string
  devotionalId: string
  memberId: string
  reactionType: DevotionalReactionType
}
