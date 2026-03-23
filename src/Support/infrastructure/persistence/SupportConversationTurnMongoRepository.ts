import { MongoRepository } from "@abejarano/ts-mongodb-criteria"
import { Collection } from "mongodb"
import type {
  SupportConversationHistoryEntry,
  SupportConversationTurn,
} from "@/Support/domain/types/SupportConversation.type"

class SupportConversationTurnDocument {}

export class SupportConversationTurnMongoRepository extends MongoRepository<any> {
  private static instance: SupportConversationTurnMongoRepository

  private constructor() {
    super(SupportConversationTurnDocument)
  }

  static getInstance(): SupportConversationTurnMongoRepository {
    if (!this.instance) {
      this.instance = new SupportConversationTurnMongoRepository()
    }

    return this.instance
  }

  collectionName(): string {
    return "support_conversation_turns"
  }

  protected async ensureIndexes(collection: Collection): Promise<void> {
    await collection.createIndex(
      { churchId: 1, userId: 1, conversationId: 1, createdAt: -1 },
      { name: "support_conversation_turn_recent_idx" }
    )
  }

  async appendTurn(turn: SupportConversationTurn): Promise<void> {
    const collection = await this.collection()
    await collection.insertOne(turn)
  }

  async listRecentTurns(params: {
    churchId: string
    userId: string
    conversationId: string
    limit: number
  }): Promise<SupportConversationHistoryEntry[]> {
    const collection = await this.collection()
    const result = await collection
      .find({
        churchId: params.churchId,
        userId: params.userId,
        conversationId: params.conversationId,
      })
      .sort({ createdAt: -1 })
      .limit(params.limit)
      .toArray()

    return result.reverse().map((item) => ({
      question: item.question,
      answer: item.answer,
      intent: item.intent,
      response: item.response,
      analysisTarget: item.analysisTarget,
      attachments: Array.isArray(item.attachments) ? item.attachments : [],
      sources: Array.isArray(item.sources) ? item.sources : [],
      createdAt: item.createdAt,
    }))
  }

  async listAllTurns(params: {
    churchId: string
    userId: string
    conversationId: string
  }): Promise<SupportConversationHistoryEntry[]> {
    const collection = await this.collection()
    const result = await collection
      .find({
        churchId: params.churchId,
        userId: params.userId,
        conversationId: params.conversationId,
      })
      .sort({ createdAt: 1 })
      .toArray()

    return result.map((item) => ({
      question: item.question,
      answer: item.answer,
      intent: item.intent,
      response: item.response,
      analysisTarget: item.analysisTarget,
      attachments: Array.isArray(item.attachments) ? item.attachments : [],
      sources: Array.isArray(item.sources) ? item.sources : [],
      createdAt: item.createdAt,
    }))
  }

  async deleteConversationTurns(params: {
    churchId: string
    userId: string
    conversationId: string
  }): Promise<void> {
    const collection = await this.collection()
    await collection.deleteMany({
      churchId: params.churchId,
      userId: params.userId,
      conversationId: params.conversationId,
    })
  }
}
