import type { DevotionalReaction } from "@/Church/domain"
import type { DevotionalReactionType } from "@/Church/domain"

export interface IDevotionalReactionRepository {
  upsert(reaction: DevotionalReaction): Promise<void>
  findByDevotionalAndMember(
    churchId: string,
    devotionalId: string,
    memberId: string
  ): Promise<DevotionalReaction | undefined>
  deleteByDevotionalAndMember(
    churchId: string,
    devotionalId: string,
    memberId: string
  ): Promise<void>
  countByDevotional(
    churchId: string,
    devotionalId: string
  ): Promise<Partial<Record<DevotionalReactionType, number>>>
}
