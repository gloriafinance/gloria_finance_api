import type { DevotionalComment } from "@/Church/domain"

export interface IDevotionalCommentRepository {
  create(comment: DevotionalComment): Promise<void>
  listRecentByDevotional(
    churchId: string,
    devotionalId: string,
    limit: number
  ): Promise<DevotionalComment[]>
  countByDevotional(churchId: string, devotionalId: string): Promise<number>
}
