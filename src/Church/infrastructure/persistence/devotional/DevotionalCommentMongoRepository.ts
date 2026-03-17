import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  DevotionalComment,
  type IDevotionalCommentRepository,
} from "@/Church/domain"
import type { Collection } from "mongodb"

export class DevotionalCommentMongoRepository
  extends MongoRepository<DevotionalComment>
  implements IDevotionalCommentRepository
{
  private static instance: DevotionalCommentMongoRepository

  private constructor() {
    super(DevotionalComment)
  }

  static getInstance(): DevotionalCommentMongoRepository {
    if (!DevotionalCommentMongoRepository.instance) {
      DevotionalCommentMongoRepository.instance =
        new DevotionalCommentMongoRepository()
    }
    return DevotionalCommentMongoRepository.instance
  }

  collectionName(): string {
    return "devotional_comments"
  }

  async save(comment: DevotionalComment): Promise<void> {
    const collection = await this.collection()
    const payload = comment.toPrimitives()

    await collection.updateOne(
      {
        churchId: payload.churchId,
        devotionalId: payload.devotionalId,
        commentId: payload.commentId,
      },
      { $set: payload },
      { upsert: true }
    )
  }

  async findByCommentId(
    churchId: string,
    devotionalId: string,
    commentId: string
  ): Promise<DevotionalComment | undefined> {
    const collection = await this.collection()
    const row = await collection.findOne({ churchId, devotionalId, commentId })

    if (!row) {
      return undefined
    }

    return DevotionalComment.fromPrimitives({
      id: row._id.toString(),
      ...row,
    })
  }

  async listRecentByDevotional(
    churchId: string,
    devotionalId: string,
    limit: number
  ): Promise<DevotionalComment[]> {
    const collection = await this.collection()
    const rows = await collection
      .find({ churchId, devotionalId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()

    return rows.map((row) =>
      DevotionalComment.fromPrimitives({
        id: row._id.toString(),
        ...row,
      })
    )
  }

  async countByDevotional(
    churchId: string,
    devotionalId: string
  ): Promise<number> {
    const collection = await this.collection()
    return collection.countDocuments({ churchId, devotionalId })
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex(
      { churchId: 1, devotionalId: 1, commentId: 1 },
      { unique: true, name: "idx_devotional_comment_unique" }
    )
    await collection.createIndex(
      { churchId: 1, devotionalId: 1, createdAt: -1 },
      { name: "idx_devotional_comment_recent" }
    )
  }
}
