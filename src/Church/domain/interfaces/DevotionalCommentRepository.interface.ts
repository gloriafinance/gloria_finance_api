import type { DevotionalComment } from "@/Church/domain"

export interface IDevotionalCommentRepository {
  save(comment: DevotionalComment): Promise<void>
  findByCommentId(
    churchId: string,
    devotionalId: string,
    commentId: string
  ): Promise<DevotionalComment | undefined>
  listRecentByDevotional(
    churchId: string,
    devotionalId: string,
    limit: number
  ): Promise<DevotionalComment[]>
  countByDevotional(churchId: string, devotionalId: string): Promise<number>
}
