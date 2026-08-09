import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { DateBR } from "@/Shared/helpers"
import {
  type DevotionalReactionPrimitives,
  type DevotionalReactionType,
} from "@/Church/domain"

export class DevotionalReaction extends AggregateRoot {
  private churchId: string
  private devotionalId: string
  private memberId: string
  private reactionType: DevotionalReactionType
  private createdAt: Date
  private updatedAt: Date

  static create(params: {
    churchId: string
    devotionalId: string
    memberId: string
    reactionType: DevotionalReactionType
  }): DevotionalReaction {
    const reaction = new DevotionalReaction()
    const now = DateBR()

    reaction.churchId = params.churchId
    reaction.devotionalId = params.devotionalId
    reaction.memberId = params.memberId
    reaction.reactionType = params.reactionType
    reaction.createdAt = now
    reaction.updatedAt = now

    return reaction
  }

  static fromPrimitives(payload: any): DevotionalReaction {
    const reaction = new DevotionalReaction()
    reaction.churchId = payload.churchId
    reaction.devotionalId = payload.devotionalId
    reaction.memberId = payload.memberId
    reaction.reactionType = payload.reactionType
    reaction.createdAt = payload.createdAt
      ? new Date(payload.createdAt)
      : DateBR()
    reaction.updatedAt = payload.updatedAt
      ? new Date(payload.updatedAt)
      : DateBR()
    return reaction
  }

  changeReactionType(reactionType: DevotionalReactionType) {
    this.reactionType = reactionType
    this.updatedAt = DateBR()
  }

  getReactionType(): DevotionalReactionType {
    return this.reactionType
  }

  toPrimitives(): DevotionalReactionPrimitives {
    return {
      churchId: this.churchId,
      devotionalId: this.devotionalId,
      memberId: this.memberId,
      reactionType: this.reactionType,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
