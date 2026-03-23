import { IdentifyEntity } from "@/Shared/adapter"
import { GenericException } from "@/Shared/domain"
import type { File } from "@/Shared/domain/types/file"
import type { SupportAnalysisTarget } from "@/Support/domain/requests/SupportAssistant.request"
import type {
  AppendSupportConversationTurnParams,
  SupportConversationAttachment,
  SupportConversation,
  SupportConversationHistoryEntry,
  SupportConversationSummary,
} from "@/Support/domain/types/SupportConversation.type"
import { SupportConversationMongoRepository } from "@/Support/infrastructure/persistence/SupportConversationMongoRepository"
import { SupportConversationTurnMongoRepository } from "@/Support/infrastructure/persistence/SupportConversationTurnMongoRepository"

type ResolveSupportConversationParams = {
  churchId: string
  userId: string
  question: string
  analysisTarget?: SupportAnalysisTarget
  conversationId?: string
}

type ResolvedSupportConversation = {
  conversationId: string
  history: SupportConversationHistoryEntry[]
}

export class SupportConversationMemoryService {
  constructor(
    private readonly conversationRepository = SupportConversationMongoRepository.getInstance(),
    private readonly turnRepository = SupportConversationTurnMongoRepository.getInstance()
  ) {}

  async resolveConversation(
    params: ResolveSupportConversationParams
  ): Promise<ResolvedSupportConversation> {
    const requestedConversationId = params.conversationId?.trim()

    if (requestedConversationId) {
      const conversation =
        await this.conversationRepository.findOwnedConversation({
          churchId: params.churchId,
          userId: params.userId,
          conversationId: requestedConversationId,
        })

      if (!conversation) {
        throw new GenericException("Support conversation not found")
      }

      const history = await this.turnRepository.listRecentTurns({
        churchId: params.churchId,
        userId: params.userId,
        conversationId: requestedConversationId,
        limit: 8,
      })

      return {
        conversationId: requestedConversationId,
        history,
      }
    }

    const now = new Date().toISOString()
    const conversation: SupportConversation = {
      conversationId: IdentifyEntity.get("supportConversation"),
      churchId: params.churchId,
      userId: params.userId,
      title: this.buildTitle(params.question, params.analysisTarget),
      createdAt: now,
      updatedAt: now,
    }

    await this.conversationRepository.createConversation(conversation)

    return {
      conversationId: conversation.conversationId,
      history: [],
    }
  }

  async appendTurn(params: AppendSupportConversationTurnParams): Promise<void> {
    const createdAt = new Date().toISOString()

    await this.turnRepository.appendTurn({
      conversationId: params.conversationId,
      churchId: params.churchId,
      userId: params.userId,
      question: params.question,
      answer: params.response.answer,
      intent: params.response.intent,
      response: params.response,
      analysisTarget: params.analysisTarget,
      attachments: this.serializeAttachments(params.files),
      sources: params.response.sources,
      createdAt,
    })

    await this.conversationRepository.touchConversation(
      params.conversationId,
      createdAt
    )
  }

  async listRecentConversations(params: {
    churchId: string
    userId: string
  }): Promise<SupportConversationSummary[]> {
    return this.conversationRepository.listRecentConversations({
      churchId: params.churchId,
      userId: params.userId,
      limit: 12,
    })
  }

  async loadConversationTurns(params: {
    churchId: string
    userId: string
    conversationId: string
  }): Promise<SupportConversationHistoryEntry[]> {
    const conversation =
      await this.conversationRepository.findOwnedConversation({
        churchId: params.churchId,
        userId: params.userId,
        conversationId: params.conversationId,
      })

    if (!conversation) {
      throw new GenericException("Support conversation not found")
    }

    return this.turnRepository.listAllTurns(params)
  }

  async deleteConversation(params: {
    churchId: string
    userId: string
    conversationId: string
  }): Promise<void> {
    const deleted = await this.conversationRepository.deleteOwnedConversation({
      churchId: params.churchId,
      userId: params.userId,
      conversationId: params.conversationId,
    })

    if (!deleted) {
      throw new GenericException("Support conversation not found")
    }

    await this.turnRepository.deleteConversationTurns(params)
  }

  private buildTitle(
    question: string,
    analysisTarget?: SupportAnalysisTarget
  ): string {
    const base = analysisTarget?.title?.trim() || question.trim()
    return base.length <= 120 ? base : `${base.slice(0, 117)}...`
  }

  private serializeAttachments(
    files?: File[]
  ): SupportConversationAttachment[] | undefined {
    if (!files?.length) {
      return undefined
    }

    return files.map((file) => ({
      name: file.name,
      mimeType: file.mimeType,
      size: file.data.byteLength,
      dataBase64: file.data.toString("base64"),
    }))
  }
}
