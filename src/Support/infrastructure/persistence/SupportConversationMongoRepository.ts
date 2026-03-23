import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { Collection } from "mongodb"
import type {
  SupportConversation,
  SupportConversationSummary,
} from "@/Support/domain/types/SupportConversation.type"

class SupportConversationDocument {}

export class SupportConversationMongoRepository extends MongoRepository<any> {
  private static instance: SupportConversationMongoRepository

  private constructor() {
    super(SupportConversationDocument)
  }

  static getInstance(): SupportConversationMongoRepository {
    if (!this.instance) {
      this.instance = new SupportConversationMongoRepository()
    }

    return this.instance
  }

  collectionName(): string {
    return "support_conversations"
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex(
      { churchId: 1, userId: 1, conversationId: 1 },
      { unique: true, name: "support_conversation_owner_idx" }
    )
    await collection.createIndex(
      { churchId: 1, userId: 1, updatedAt: -1 },
      { name: "support_conversation_recent_idx" }
    )
  }

  async createConversation(conversation: SupportConversation): Promise<void> {
    const collection = await this.collection()
    await collection.insertOne(conversation)
  }

  async findOwnedConversation(params: {
    churchId: string
    userId: string
    conversationId: string
  }): Promise<SupportConversation | undefined> {
    const collection = await this.collection()
    const result = await collection.findOne(params)

    return result ? (result as SupportConversation) : undefined
  }

  async touchConversation(
    conversationId: string,
    updatedAt: string
  ): Promise<void> {
    const collection = await this.collection()
    await collection.updateOne({ conversationId }, { $set: { updatedAt } })
  }

  async listRecentConversations(params: {
    churchId: string
    userId: string
    limit: number
  }): Promise<SupportConversationSummary[]> {
    const collection = await this.collection()
    const result = await collection
      .find({
        churchId: params.churchId,
        userId: params.userId,
      })
      .sort({ updatedAt: -1 })
      .limit(params.limit)
      .project({
        _id: 0,
        conversationId: 1,
        title: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .toArray()

    return result as SupportConversationSummary[]
  }

  async deleteOwnedConversation(params: {
    churchId: string
    userId: string
    conversationId: string
  }): Promise<boolean> {
    const collection = await this.collection()
    const result = await collection.deleteOne(params)
    return result.deletedCount > 0
  }
}
