export type SupportAnalysisTargetType = "report" | "text"

export type SupportAnalysisTarget = {
  type: SupportAnalysisTargetType
  title: string
  data: string | Record<string, unknown> | unknown[]
}

export type SupportAssistantRequest = {
  question: string
  conversationId?: string
  analysisTarget?: SupportAnalysisTarget
}
