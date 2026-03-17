import type { DevotionalReactionType } from "@/Church/domain"

export type DevotionalReactionPrimitives = {
  churchId: string
  devotionalId: string
  memberId: string
  reactionType: DevotionalReactionType
  createdAt: Date
  updatedAt: Date
}

export type DevotionalCommentPrimitives = {
  commentId: string
  churchId: string
  devotionalId: string
  memberId: string
  authorName: string
  message: string
  createdAt: Date
  updatedAt: Date
}

export type DevotionalCommunityReactionsResponse = {
  viewerReactionType: DevotionalReactionType | null
  totals: Record<DevotionalReactionType, number>
  total: number
}

export type DevotionalCommunityCommentsResponse = {
  total: number
  items: DevotionalCommentPrimitives[]
}
