import type { File } from "@/Shared/domain/types/file"
import { GenericException } from "@/Shared/domain"
import { FinancialConcept } from "@/FinanceConfig/domain"
import type { SupportAnalysisTarget } from "@/Support/domain/requests/SupportAssistant.request"
import type { SupportAssistantResponse } from "@/Support/domain/types/SupportAssistant.response"
import type { SupportConversationHistoryEntry } from "@/Support/domain/types/SupportConversation.type"
import { SupportDocumentVisionAgent } from "@/Support/infrastructure/agents/SupportDocumentVision.agent"
import { SupportResponderAgent } from "@/Support/infrastructure/agents/SupportResponder.agent"
import { SupportIntentClassifierService } from "@/Support/infrastructure/services/SupportIntentClassifier.service"
import { SupportKnowledgeRetrieverService } from "@/Support/infrastructure/services/SupportKnowledgeRetriever.service"

type SupportAssistantExecuteParams = {
  question: string
  analysisTarget?: SupportAnalysisTarget
  files: File[]
  lang: string
  churchId: string
  financialConcepts: FinancialConcept[]
  conversationHistory: SupportConversationHistoryEntry[]
}

export class SupportAssistantAgent {
  constructor(
    private readonly intentClassifier = new SupportIntentClassifierService(),
    private readonly knowledgeRetriever = new SupportKnowledgeRetrieverService(),
    private readonly visionAgent = new SupportDocumentVisionAgent(),
    private readonly responderAgent = new SupportResponderAgent()
  ) {}

  async execute(
    params: SupportAssistantExecuteParams
  ): Promise<SupportAssistantResponse> {
    const question = params.question.trim()
    if (!question) {
      throw new GenericException("Field `question` is required")
    }

    const analysisTarget = this.normalizeAnalysisTarget(params.analysisTarget)

    const intent = this.intentClassifier.classify({
      question,
      hasFiles: params.files.length > 0,
      hasAnalysisTarget: Boolean(analysisTarget),
      analysisTarget,
    })

    const knowledge = this.knowledgeRetriever.retrieve({
      question,
      intent,
      analysisTarget,
    })

    const relevantConcepts = this.selectRelevantConcepts(
      params.financialConcepts,
      question
    )
    const conceptSources = relevantConcepts.map(
      (concept) => `concept:${concept.getFinancialConceptId()}`
    )
    const allowedSources = [...knowledge.sourceIds, ...conceptSources]

    const filesForVision = this.resolveFilesForVision(
      params.files,
      params.conversationHistory,
      question,
      analysisTarget
    )
    const vision =
      filesForVision.length > 0
        ? await this.visionAgent.execute(filesForVision, question)
        : undefined

    return this.responderAgent.execute({
      question,
      lang: params.lang,
      intent,
      churchId: params.churchId,
      knowledgeContext: knowledge.contextText,
      analysisTarget,
      conversationHistory: params.conversationHistory,
      visualContext: vision,
      financialConcepts: relevantConcepts,
      allowedSources,
      allowedRoutes: knowledge.routes,
      allowedScreens: knowledge.screenTitles,
    })
  }

  private selectRelevantConcepts(
    concepts: FinancialConcept[],
    question: string
  ): FinancialConcept[] {
    const normalizedQuestion = this.normalize(question)
    const searchTerms = this.buildSearchTerms(normalizedQuestion)
    const scored = concepts
      .map((concept) => ({
        concept,
        score: this.scoreConcept(concept, searchTerms, normalizedQuestion),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)

    return scored.map((item) => item.concept)
  }

  private scoreConcept(
    concept: FinancialConcept,
    searchTerms: string[],
    normalizedQuestion: string
  ) {
    let score = 0
    const name = this.normalize(concept.getName())
    const description = this.normalize(concept.getDescription())

    for (const token of searchTerms) {
      if (token.length < 4) continue
      if (name.includes(token)) score += 4
      if (description.includes(token)) score += 2
    }

    if (this.isContributionQuestion(normalizedQuestion)) {
      if (
        this.matchesAny(name, [
          "diezmo",
          "dizimo",
          "ofrenda",
          "oferta",
          "donacion",
          "doacao",
          "contribucion",
          "contribuicao",
          "primicia",
          "primicia",
        ])
      ) {
        score += 4
      }
    }

    return score
  }

  private buildSearchTerms(normalizedQuestion: string): string[] {
    const terms = new Set(
      normalizedQuestion
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
    )

    if (this.isContributionQuestion(normalizedQuestion)) {
      for (const token of [
        "contribucion",
        "contribuicao",
        "ofrenda",
        "oferta",
        "donacion",
        "doacao",
        "diezmo",
        "dizimo",
        "primicia",
      ]) {
        terms.add(token)
      }
    }

    return [...terms]
  }

  private isContributionQuestion(normalizedQuestion: string): boolean {
    return this.matchesAny(normalizedQuestion, [
      "contribucion",
      "contribuicao",
      "ofrenda",
      "oferta",
      "donacion",
      "doacao",
      "diezmo",
      "dizimo",
      "primicia",
      "firstfruits",
    ])
  }

  private matchesAny(value: string, patterns: string[]): boolean {
    return patterns.some((pattern) => value.includes(pattern))
  }

  private normalize(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
  }

  private normalizeAnalysisTarget(
    target?: SupportAnalysisTarget
  ): SupportAnalysisTarget | undefined {
    if (!target) {
      return undefined
    }

    if (typeof target !== "object") {
      throw new GenericException("Field `analysisTarget` must be an object")
    }

    if (target.type !== "report" && target.type !== "text") {
      throw new GenericException(
        "Field `analysisTarget.type` must be 'report' or 'text'"
      )
    }

    const title = target.title?.trim()
    if (!title) {
      throw new GenericException("Field `analysisTarget.title` is required")
    }

    const data = target.data
    const isArray = Array.isArray(data)
    const isObject =
      typeof data === "object" && data !== null && !Array.isArray(data)
    const isString = typeof data === "string"

    if (!isString && !isArray && !isObject) {
      throw new GenericException(
        "Field `analysisTarget.data` must be string, object or array"
      )
    }

    if (isString && data.trim().length === 0) {
      throw new GenericException(
        "Field `analysisTarget.data` must not be empty"
      )
    }

    if ((isArray || isObject) && JSON.stringify(data) === "{}") {
      throw new GenericException(
        "Field `analysisTarget.data` must not be empty"
      )
    }

    return {
      type: target.type,
      title,
      data,
    }
  }

  private resolveFilesForVision(
    files: File[],
    history: SupportConversationHistoryEntry[],
    question: string,
    analysisTarget?: SupportAnalysisTarget
  ): File[] {
    if (files.length > 0) {
      return files
    }

    if (analysisTarget) {
      return []
    }

    if (!this.shouldReuseAttachmentContext(question)) {
      return []
    }

    for (const entry of [...history].reverse()) {
      if (!entry.attachments?.length) {
        continue
      }

      const imageFiles = entry.attachments
        .filter((attachment) => attachment.mimeType.startsWith("image/"))
        .map((attachment) => ({
          name: attachment.name,
          mimeType: attachment.mimeType,
          data: Buffer.from(attachment.dataBase64, "base64"),
        }))

      if (imageFiles.length > 0) {
        return imageFiles
      }
    }

    return []
  }

  private shouldReuseAttachmentContext(question: string): boolean {
    const normalizedQuestion = this.normalize(question)

    return this.matchesAny(normalizedQuestion, [
      "esta ",
      "este ",
      "isso",
      "isto",
      "imagen",
      "imagem",
      "image",
      "documento",
      "document",
      "factura",
      "fatura",
      "comprobante",
      "comprovante",
      "receipt",
      "nota",
      "archivo",
      "arquivo",
    ])
  }
}
