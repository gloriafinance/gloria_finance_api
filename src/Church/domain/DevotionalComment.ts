import { AggregateRoot } from "@abejarano/ts-mongodb-criteria"
import { IdentifyEntity } from "@/Shared/adapter"
import { DateBR } from "@/Shared/helpers"
import type { DevotionalCommentPrimitives } from "@/Church/domain"

export class DevotionalComment extends AggregateRoot {
  private id?: string
  private commentId: string
  private churchId: string
  private devotionalId: string
  private memberId: string
  private authorName: string
  private message: string
  private createdAt: Date
  private updatedAt: Date

  static create(params: {
    churchId: string
    devotionalId: string
    memberId: string
    authorName: string
    message: string
  }): DevotionalComment {
    const comment = new DevotionalComment()
    const now = DateBR()

    comment.commentId = IdentifyEntity.get("devotional-comment")
    comment.churchId = params.churchId
    comment.devotionalId = params.devotionalId
    comment.memberId = params.memberId
    comment.authorName = params.authorName.trim()
    comment.message = params.message.trim()
    comment.createdAt = now
    comment.updatedAt = now

    return comment
  }

  static override fromPrimitives(payload: any): DevotionalComment {
    const comment = new DevotionalComment()
    comment.id = payload.id
    comment.commentId = payload.commentId
    comment.churchId = payload.churchId
    comment.devotionalId = payload.devotionalId
    comment.memberId = payload.memberId
    comment.authorName = payload.authorName
    comment.message = payload.message
    comment.createdAt = payload.createdAt
      ? new Date(payload.createdAt)
      : DateBR()
    comment.updatedAt = payload.updatedAt
      ? new Date(payload.updatedAt)
      : DateBR()
    return comment
  }

  getId(): string | undefined {
    return this.id
  }

  getCommentId(): string {
    return this.commentId
  }

  getMemberId(): string {
    return this.memberId
  }

  updateMessage(message: string) {
    this.message = message.trim()
    this.updatedAt = DateBR()
  }

  toPrimitives(): DevotionalCommentPrimitives {
    return {
      commentId: this.commentId,
      churchId: this.churchId,
      devotionalId: this.devotionalId,
      memberId: this.memberId,
      authorName: this.authorName,
      message: this.message,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
