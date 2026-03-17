import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import {
  DevotionalReaction,
  type DevotionalReactionType,
  type IDevotionalReactionRepository,
} from "@/Church/domain"
import type { Collection } from "mongodb"

export class DevotionalReactionMongoRepository
  extends MongoRepository<DevotionalReaction>
  implements IDevotionalReactionRepository
{
  private static instance: DevotionalReactionMongoRepository

  private constructor() {
    super(DevotionalReaction)
  }

  static getInstance(): DevotionalReactionMongoRepository {
    if (!DevotionalReactionMongoRepository.instance) {
      DevotionalReactionMongoRepository.instance =
        new DevotionalReactionMongoRepository()
    }
    return DevotionalReactionMongoRepository.instance
  }

  collectionName(): string {
    return "devotional_reactions"
  }

  async upsert(reaction: DevotionalReaction): Promise<void> {
    const collection = await this.collection()
    const payload = reaction.toPrimitives()

    await collection.updateOne(
      {
        churchId: payload.churchId,
        devotionalId: payload.devotionalId,
        memberId: payload.memberId,
      },
      { $set: payload },
      { upsert: true }
    )
  }

  async findByDevotionalAndMember(
    churchId: string,
    devotionalId: string,
    memberId: string
  ): Promise<DevotionalReaction | undefined> {
    const collection = await this.collection()
    const document = await collection.findOne({
      churchId,
      devotionalId,
      memberId,
    })

    if (!document) {
      return undefined
    }

    return DevotionalReaction.fromPrimitives({
      id: document._id.toString(),
      ...document,
    })
  }

  async deleteByDevotionalAndMember(
    churchId: string,
    devotionalId: string,
    memberId: string
  ): Promise<void> {
    const collection = await this.collection()
    await collection.deleteOne({ churchId, devotionalId, memberId })
  }

  async countByDevotional(
    churchId: string,
    devotionalId: string
  ): Promise<Partial<Record<DevotionalReactionType, number>>> {
    const collection = await this.collection()
    const rows = await collection
      .aggregate([
        { $match: { churchId, devotionalId } },
        { $group: { _id: "$reactionType", count: { $sum: 1 } } },
      ])
      .toArray()

    return rows.reduce(
      (acc, row) => ({
        ...acc,
        [row._id]: Number(row.count ?? 0),
      }),
      {} as Partial<Record<DevotionalReactionType, number>>
    )
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex(
      { churchId: 1, devotionalId: 1, memberId: 1 },
      { unique: true, name: "idx_devotional_reaction_member_unique" }
    )
    await collection.createIndex(
      { churchId: 1, devotionalId: 1, reactionType: 1 },
      { name: "idx_devotional_reaction_lookup" }
    )
  }
}
